// Structural diagnostics for the dedicated Edge test profile. Opt-in probes activate file controls.
// Never print conversation text, attachment titles, or signed resource URLs.
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const [port,path]=(await readFile(join(root,'test-output/manual-edge/DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);
const ws=new WebSocket('ws://127.0.0.1:'+port+path);
await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
let seq=0;const pending=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data);const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.no(Error(m.error.message)):p.ok(m.result);}};
function call(method,params={},sessionId){return new Promise((ok,no)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);no(Error(method+' timed out'));},10000);pending.set(id,{ok,no,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
try{
  const targets=(await call('Target.getTargets')).targetInfos.filter(t=>t.type==='page'&&((process.argv.includes('--export-status')||process.argv.includes('--cancel-export'))?/^chrome-extension:\/\/[^/]+\/src\/ui\/index.html/.test(t.url):/^https:\/\/(chatgpt\.com|claude\.ai|gemini\.google\.com)\//.test(t.url)));
  if(!targets.length)console.log('No supported chat is open in the dedicated Edge test profile.');
  for(const target of targets){
    const {sessionId}=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    if(process.argv.includes('--export-status')){
      const result=await call('Runtime.evaluate',{returnByValue:true,expression:"({busy:document.getElementById('shell')?.getAttribute('aria-busy'),progress:document.getElementById('progressLabel')?.textContent.replace(/Preparing .+/,'Preparing attachment'),error:document.getElementById('status')?.classList.contains('error'),pages:document.getElementById('pageLabel')?.textContent,canvas:document.getElementById('pdfCanvas')?.width})"},sessionId);
      console.log(JSON.stringify(result.result?.value));continue;
    }
    if(process.argv.includes('--cancel-export')){
      await call('Runtime.evaluate',{expression:"document.getElementById('cancel')?.click()"},sessionId);continue;
    }
    if(process.argv.includes('--metadata')){
      const result=await call('Runtime.evaluate',{returnByValue:true,expression:'('+(()=>{
        return {
          favicon:[...document.querySelectorAll('link[rel*="icon"]')].map(n=>n.href),
          controls:[...document.querySelectorAll('[data-testid*="model"],[data-testid*="effort"],[data-testid*="thinking"],[data-model]')]
            .filter(n=>!n.closest('[data-message-author-role]')).map(n=>({tag:n.tagName,testid:n.getAttribute('data-testid'),text:n.textContent.slice(0,100),aria:n.getAttribute('aria-label')})),
          messageAttributes:[...new Set([...document.querySelectorAll('[data-message-author-role]')].flatMap(n=>[...n.attributes].map(a=>a.name)))],
          folded:[...document.querySelectorAll('[data-message-author-role] [aria-expanded="false"]')].map(n=>({tag:n.tagName,testid:n.getAttribute('data-testid'),controls:!!n.getAttribute('aria-controls'),summary:/^(show|read|expand|thought|thinking)/i.test(n.textContent.trim())}))
        };
      }).toString()+')()'},sessionId);
      console.log(JSON.stringify(result.result?.value,null,2));continue;
    }
    if(process.argv.includes('--loading')){
      const r=await call('Runtime.evaluate',{returnByValue:true,expression:'('+(()=>{
        const first=document.querySelector('[data-message-author-role]'),scrollers=[];
        for(let n=first?.parentElement;n;n=n.parentElement)if(n.scrollHeight>n.clientHeight+2)scrollers.push({tag:n.tagName,class:n.className,top:n.scrollTop,height:n.scrollHeight,client:n.clientHeight,overflow:getComputedStyle(n).overflowY});
        return {busy:[...document.querySelectorAll('[aria-busy="true"],[data-testid="loading-indicator"],[data-testid="conversation-loading"]')].map(n=>({tag:n.tagName,class:n.className,testid:n.getAttribute('data-testid'),visible:!!n.getClientRects().length,insideMessage:!!n.closest('[data-message-author-role]')})),scrollers};
      }).toString()+')()'},sessionId);
      console.log(JSON.stringify(r.result?.value));continue;
    }
    const result=await call('Runtime.evaluate',{returnByValue:true,expression:'('+(()=>{
      const roles='[data-message-author-role],user-query,model-response,[data-testid="user-message"],[data-testid="assistant-message"]';
      const region=document.querySelector('main')||document.body;
      const ancestors=el=>{const list=[];for(let n=el;n&&list.length<6;n=n.parentElement)list.push({tag:n.tagName,testid:n.getAttribute('data-testid'),role:n.getAttribute('data-message-author-role'),class:n.className?.toString().slice(0,180)});return list;};
      const links=[...region.querySelectorAll('a[href]')].filter(a=>a.hasAttribute('download')||/\.(pdf|docx|pptx|xlsx|png|jpe?g|webp|zip)\b/i.test(a.textContent+' '+a.getAttribute('href')));
      return {host:location.hostname,ready:document.readyState,messageCounts:{semantic:document.querySelectorAll('[data-message-author-role]').length,userTest:document.querySelectorAll('[data-testid="user-message"]').length,assistantTest:document.querySelectorAll('[data-testid="assistant-message"]').length,gemini:document.querySelectorAll('user-query,model-response').length},
        dialogs:[...document.querySelectorAll('[role="dialog"]')].map(d=>({textLength:d.textContent.length,errorCategory:/expired|no longer available|not found|failed|couldn.t download|unable to download/i.test(d.textContent)?'file error':/download/i.test(d.textContent)?'download mentioned':'other',tags:[...new Set([...d.querySelectorAll('*')].map(n=>n.tagName))],controls:[...d.querySelectorAll('button')].map(b=>({aria:((b.getAttribute('aria-label')||'').match(/^(Download|Exit full screen|Go to previous slide|Go to next slide|Show slide list|Close)$/i)?.[0]||'[omitted]'),textLength:b.textContent.length})),dataAttrs:[...d.querySelectorAll('[data-state],[data-testid]')].slice(0,12).map(n=>({tag:n.tagName,testid:n.getAttribute('data-testid'),state:n.getAttribute('data-state')}))})),
        images:[...region.querySelectorAll('img')].slice(0,20).map(img=>({loaded:img.complete,natural:[img.naturalWidth,img.naturalHeight],scheme:(img.currentSrc||img.src).split(':')[0],origin:(()=>{try{return new URL(img.currentSrc||img.src).origin}catch{return null}})(),insideMessage:!!img.closest(roles),insideTurn:!!img.closest('article'),ancestors:ancestors(img)})),
        links:links.slice(0,20).map(a=>({extension:(a.textContent+' '+a.getAttribute('href')).match(/\.(pdf|docx|pptx|xlsx|png|jpe?g|webp|zip)\b/i)?.[1],scheme:a.getAttribute('href').split(':')[0],origin:(()=>{try{return new URL(a.href).origin}catch{return null}})(),download:a.hasAttribute('download'),insideMessage:!!a.closest(roles),ancestors:ancestors(a)})),
        fileCards:[...region.querySelectorAll('button,[role="button"]')].filter(b=>/\.(pdf|docx|pptx|xlsx)\b/i.test(b.textContent)).slice(0,10).map(b=>({extension:b.textContent.match(/\.(pdf|docx|pptx|xlsx)\b/i)?.[1],expanded:b.getAttribute('aria-expanded'),controls:!!b.getAttribute('aria-controls'),insideMessage:!!b.closest(roles),ancestors:ancestors(b)})),
        artifactNodes:[...document.querySelectorAll('[data-testid*="artifact"],[data-artifact-content]')].slice(0,10).map(n=>({tag:n.tagName,testid:n.getAttribute('data-testid')})),
        fileButtonAttributes:[...region.querySelectorAll('button')].filter(b=>/\.(pdf|docx|pptx|xlsx)\b/i.test(b.textContent)).slice(0,5).map(b=>({attributes:[...b.attributes].map(a=>({name:a.name,value:/^(type|role|data-entity-type|aria-haspopup|data-state|data-testid)$/.test(a.name)?a.value:'[not logged]'})),parentTags:[...b.parentElement.children].map(n=>n.tagName),childTags:[...b.querySelectorAll('*')].map(n=>n.tagName).slice(0,10)}))};
    }).toString()+')()'},sessionId);
    console.log(JSON.stringify(process.argv.includes('--dialog-only')?result.result?.value?.dialogs:result.result?.value||{error:result.exceptionDetails?.text},null,2));
    if(process.argv.includes('--probe-file')||process.argv.includes('--probe-download')){
      const probe=await call('Runtime.evaluate',{returnByValue:true,awaitPromise:true,expression:'('+ (async()=>{
        const button=document.querySelector('[role="dialog"] button[aria-label="Download"]')||[...document.querySelectorAll('[data-message-author-role] button.behavior-btn')].find(b=>/\.(pptx|docx|pdf)\b/i.test(b.textContent));
        if(!button)return {found:false};
        const original=HTMLAnchorElement.prototype.click,open=window.open,seen=[];
        const remember=(url,download)=>{try{const u=new URL(url,location.href);seen.push({origin:u.origin,scheme:u.protocol,download:!!download});}catch{}};
        HTMLAnchorElement.prototype.click=function(){remember(this.href,this.download);};
        window.open=function(url){remember(url,false);return null;};
        try{button.click();await new Promise(r=>setTimeout(r,3000));return {found:true,resourceEvents:seen,dialogs:[...document.querySelectorAll('[role="dialog"]')].map(d=>({links:d.querySelectorAll('a[href]').length,buttons:[...d.querySelectorAll('button')].map(b=>/download/i.test(b.textContent+' '+b.getAttribute('aria-label'))?'download':/close/i.test(b.getAttribute('aria-label')||'')?'close':'other')}))};}
        finally{HTMLAnchorElement.prototype.click=original;window.open=open;}
      }).toString()+')()'},sessionId);
      console.log('File activation diagnostic: '+JSON.stringify(probe.result?.value||{error:probe.exceptionDetails?.text}));
      break;
    }
  }
}finally{ws.close();}
