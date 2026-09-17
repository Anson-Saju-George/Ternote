// Explicit, local-only manual QA. No account switching, private APIs or file execution.
import {readFile,writeFile,mkdtemp,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {captureConversation,cancelCapture} from '../src/extract.js';
import {PLATFORMS} from '../src/platforms.js';
const root=resolve(import.meta.dirname,'..');
const requested=new URL(process.argv[2]);
if(requested.origin!=='https://chatgpt.com'||!/^\/c\/[\w-]+$/.test(requested.pathname))throw Error('Provide the exact ChatGPT conversation URL.');
const [port,path]=(await readFile(join(root,'test-output/manual-edge/DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);
const ws=new WebSocket('ws://127.0.0.1:'+port+path);
await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
let seq=0;const pending=new Map(),downloads=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(m.error.message)):p.ok(m.result);}
  if(m.method==='Browser.downloadWillBegin')downloads.set(m.params.guid,{...m.params,state:'inProgress'});
  if(m.method==='Browser.downloadProgress'&&downloads.has(m.params.guid))Object.assign(downloads.get(m.params.guid),m.params);
};
function call(method,params={},sessionId){return new Promise((ok,no)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);no(Error(method+' timed out'));},120000);pending.set(id,{ok,no,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
  const target=(await call('Target.getTargets')).targetInfos.find(t=>t.type==='page'&&t.url.split(/[?#]/)[0]===requested.href);
  if(!target)throw Error('The requested conversation is not open in the dedicated Edge profile.');
  const {sessionId}=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);if(r.exceptionDetails)throw Error('Page evaluation failed.');return r.result.value;}
  const folder=await mkdtemp(join(root,'test-output','chat-review-'));
  await evaluate('('+cancelCapture.toString()+')()');
  await call('Page.bringToFront',{},sessionId);
  const capture=process.argv.includes('--dom-only') ? await evaluate("(()=>{const nodes=[...document.querySelectorAll('[data-message-author-role]')];return {method:'Visible DOM diagnostic; not a completeness certification',messages:nodes.map(e=>({role:e.dataset.messageAuthorRole,text:e.innerText})),assets:[...document.querySelectorAll('[data-message-author-role] img')].map(e=>({width:e.naturalWidth,height:e.naturalHeight}))}})()") : await evaluate('('+captureConversation.toString()+')('+JSON.stringify(PLATFORMS[0])+')');
  await writeFile(join(folder,'conversation.json'),JSON.stringify(capture,null,2));
  console.log('Captured '+capture.messages.length+' messages; '+capture.assets.length+' image/file resources. Private review directory: '+folder);
  const cards=await evaluate("[...document.querySelectorAll('[data-message-author-role] button')].filter(e=>/\\.(pptx?|docx?|pdf)\\b/i.test(e.textContent)).map(e=>({name:e.textContent.trim(),role:e.closest('[data-message-author-role]').dataset.messageAuthorRole}))");
  await call('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:folder,eventsEnabled:true});
  for(const [index,card] of cards.entries()){
    const before=new Set(downloads.keys());
    const clicked=await evaluate("(()=>{const b=[...document.querySelectorAll('[data-message-author-role] button')].find(e=>e.textContent.trim()==="+JSON.stringify(card.name)+");if(!b)return false;b.click();return true})()");
    if(!clicked)continue;
    let viewer=false;
    for(const deadline=Date.now()+6000;Date.now()<deadline;){await pause(100);viewer=await evaluate("!![...document.querySelectorAll('button[aria-label=\"Download file\"],button[aria-label=\"Download\"]')].find(e=>!e.disabled&&e.getClientRects().length)");if(viewer)break;}
    if(viewer&&process.argv.includes('--fetch-viewer')){
      const file=await evaluate('('+ (async()=>{
        const b=[...document.querySelectorAll('button[aria-label="Download file"],button[aria-label="Download"]')].find(e=>!e.disabled&&e.getClientRects().length);
        const oldOpen=window.open,oldClick=HTMLAnchorElement.prototype.click;let url;
        const accept=value=>{try{const u=new URL(value,location.href);if(u.origin===location.origin&&u.protocol==='https:'&&!u.username&&!u.password){url=u.href;return true;}}catch{}return false;};
        const opened=function(value,...args){if(accept(value))return null;return oldOpen.call(this,value,...args);};
        const clicked=function(...args){if(accept(this.href))return;return oldClick.apply(this,args);};
        const restore=()=>{if(window.open===opened)window.open=oldOpen;if(HTMLAnchorElement.prototype.click===clicked)HTMLAnchorElement.prototype.click=oldClick;};
        const watchdog=setTimeout(restore,6000);
        try{window.open=opened;HTMLAnchorElement.prototype.click=clicked;b?.click();for(const deadline=Date.now()+5000;!url&&Date.now()<deadline;)await new Promise(r=>setTimeout(r,100));}
        finally{clearTimeout(watchdog);restore();}
        if(!url)return {error:'No same-origin download URL exposed'};
        try{
          const r=await fetch(url,{credentials:'same-origin',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(45000)});
          if(!r.ok)return {error:'HTTP '+r.status};
          const reader=r.body.getReader(),chunks=[];let size=0;
          try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>64*1024*1024)throw Error('File exceeds 64 MB');chunks.push(value);}}finally{await reader.cancel();}
          const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
          if(!(bytes[0]===80&&bytes[1]===75)&&!(bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70))throw Error('Not ZIP/PDF file bytes');
          let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
          return {base64:btoa(binary),size,mime:r.headers.get('content-type')};
        }catch(e){return {error:e.message};}
      }).toString()+')()');
      if(file.base64){const name='attachment-'+(index+1)+'.bin';await writeFile(join(folder,name),Buffer.from(file.base64,'base64'));await writeFile(join(folder,name+'.json'),JSON.stringify({name:card.name,role:card.role,mime:file.mime}));console.log('File '+(index+1)+' ('+card.role+'): saved '+file.size+' verified ZIP/PDF bytes.');}
      else console.log('File '+(index+1)+': '+file.error);
      continue;
    }
    if(viewer)await evaluate("[...document.querySelectorAll('button[aria-label=\"Download file\"],button[aria-label=\"Download\"]')].find(e=>!e.disabled&&e.getClientRects().length)?.click()");
    let item;
    for(let n=0;n<300;n++){await pause(100);item=[...downloads.values()].find(d=>!before.has(d.guid));if(item&&item.state!=='inProgress')break;}
    if(item?.state==='completed'){
      const bytes=await readFile(join(folder,item.guid));
      console.log('File '+(index+1)+' ('+card.role+'): downloaded '+(await stat(join(folder,item.guid))).size+' bytes; ZIP='+String(bytes[0]===80&&bytes[1]===75));
      // Filename mapping stays in the ignored review folder; no signed URLs are saved.
      await writeFile(join(folder,item.guid+'.json'),JSON.stringify({name:item.suggestedFilename,role:card.role},null,2));
    }else console.log('File '+(index+1)+' ('+card.role+'): download '+(item?.state||'not observed'));
  }
}finally{await call('Browser.setDownloadBehavior',{behavior:'default'}).catch(()=>{});for(const p of pending.values())clearTimeout(p.timer);pending.clear();ws.close();}
