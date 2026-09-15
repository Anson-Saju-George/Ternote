import {spawn} from 'node:child_process';
import {access,mkdir,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const useEdge=process.argv.includes('--edge');
const browserName=useEdge?'Edge':'Brave';
const profile=join(root,'test-output',useEdge?'manual-edge':'manual-brave');
const executable=process.env.BROWSER_PATH||(useEdge?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe');
await access(executable);await access(join(root,'dist','manifest.json'));
await mkdir(profile,{recursive:true});
const browser=spawn(executable,[
  '--no-first-run','--no-default-browser-check','--disable-background-networking',
  '--remote-debugging-port=0','--user-data-dir='+profile,
  '--disable-extensions-except='+join(root,'dist'),'--load-extension='+join(root,'dist'),
  '--new-window','about:blank'
],{detached:true,windowsHide:false,stdio:'ignore'});
browser.unref();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let endpoint;
for(let i=0;i<100;i++){
  try{
    const [port,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);
    const response=await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(500)});
    if(response.ok){endpoint='ws://127.0.0.1:'+port+path;break;}
  }catch{}
  await sleep(100);
}
if(!endpoint)throw new Error(browserName+' opened, but its testing connection was unavailable.');
const socket=new WebSocket(endpoint);
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let next=0;const pending=new Map();
socket.onmessage=e=>{
  const message=JSON.parse(e.data),p=pending.get(message.id);
  if(!p)return;pending.delete(message.id);clearTimeout(p.timer);
  message.error?p.reject(new Error(message.error.message)):p.resolve(message.result);
};
socket.onclose=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Testing connection closed.'));}pending.clear();};
function send(method,params={},sessionId){
  return new Promise((resolve,reject)=>{
    const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timed out: '+method));},5000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
}
async function evaluate(sessionId,expression){
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);
  if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
}
try{
  let extension;
  for(let i=0;i<80;i++){
    extension=(await send('Target.getTargets')).targetInfos.find(t=>t.url.startsWith('chrome-extension://')&&(t.url.includes('/src/background.js')||t.url.includes('/src/ui/index.html')));
    if(extension)break;await sleep(100);
  }
  if(!extension)throw new Error(browserName+' opened, but the development extension was not detected.');
  const base=extension.url.split('/src/')[0];
  if(process.argv.includes('--reload')){
    const {sessionId:reloadSession}=await send('Target.attachToTarget',{targetId:extension.targetId,flatten:true});
    try{await evaluate(reloadSession,'chrome.runtime.reload()');}catch{}
    await sleep(400);
  }
  const {targetId}=await send('Target.createTarget',{url:base+'/src/ui/index.html'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Page.enable',{},sessionId);await send('Runtime.enable',{},sessionId);
  for(let i=0;i<60;i++){if(await evaluate(sessionId,"document.documentElement?.dataset.ready === 'true'"))break;await sleep(100);}
  const details=await evaluate(sessionId,"({name:chrome.runtime.getManifest().name,version:chrome.runtime.getManifest().version,ready:document.documentElement.dataset.ready==='true',demoRemoved:!document.getElementById('demo')&&!document.querySelector('.conversation')})");
  if(details.name!=='Ternote'||!details.ready)throw new Error('The extension did not initialize.');
  if(process.argv.includes('--chat-preview')){
    const chatId=await evaluate(sessionId,"(async()=>{const tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'});const t=tabs.sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0];return t?.id})()");
    if(chatId){
      // Return from the native presentation preview used in attachment diagnostics; no chat edits.
      await evaluate(sessionId,"chrome.scripting.executeScript({target:{tabId:"+chatId+"},func:()=>{if(document.querySelector('[data-testid=\"artifact-preview-presentation-workspace\"]'))document.querySelector('[role=\"dialog\"] button[aria-label=\"Exit full screen\"]')?.click()}}).catch(()=>{})");
      await evaluate(sessionId,"chrome.scripting.executeScript({target:{tabId:"+chatId+"},files:['src/button.js']}).catch(()=>{})");
      await send('Page.navigate',{url:base+'/src/ui/index.html?tab='+chatId},sessionId);
      console.log('Loading the current ChatGPT conversation for PDF preview. No chat content is logged or downloaded.');
      for(let i=0;i<900;i++){
        if(await evaluate(sessionId,"document.documentElement?.dataset.ready==='true'&&document.getElementById('shell')?.getAttribute('aria-busy')==='false'"))break;
        await sleep(100);
      }
      if(!await evaluate(sessionId,"document.getElementById('shell')?.getAttribute('aria-busy')==='false'"))throw Error('Capture did not finish within the visual-test deadline. The exporter remains open with Cancel available.');
      if(await evaluate(sessionId,"document.getElementById('status').classList.contains('error')"))throw Error('The live chat could not be captured; the exporter shows the reason.');
      await evaluate(sessionId,"document.getElementById('format').value='pdf';document.getElementById('format').dispatchEvent(new Event('change'));document.getElementById('preview').click()");
      for(let i=0;i<900;i++){
        if(await evaluate(sessionId,"document.getElementById('pageLabel').textContent.includes(' / ')||document.getElementById('status').classList.contains('error')"))break;
        await sleep(100);
      }
      const preview=await evaluate(sessionId,"({pages:document.getElementById('pageLabel').textContent,error:document.getElementById('status').classList.contains('error')})");
      if(preview.error||!preview.pages)throw Error('PDF preview did not finish. The export view remains open for inspection.');
      await send('Page.bringToFront',{},sessionId);
      console.log(JSON.stringify({browser:browserName,opened:true,extension:details,pdfPreview:preview.pages,profile},null,2));
      console.log('Edge is ready for the PDF visual check. Export downloads the previewed document.');
      process.exitCode=0;
      socket.close();
      // Do not open an unrelated popup over the finished document.
      await new Promise(resolve=>setTimeout(resolve,50));
      process.exit(0);
    }
  }
  await send('Page.bringToFront',{},sessionId);
  let popupOpened=false;
  try{
    await evaluate(sessionId,'chrome.action.openPopup()');popupOpened=true;
    for(let i=0;i<40;i++){
      const popup=(await send('Target.getTargets')).targetInfos.find(t=>t.url===base+'/src/ui/index.html');
      if(popup){
        const {sessionId:popupSession}=await send('Target.attachToTarget',{targetId:popup.targetId,flatten:true});
        await send('Runtime.enable',{},popupSession);
        for(let j=0;j<30;j++){if(await evaluate(popupSession,"document.documentElement.dataset.ready === 'true'"))break;await sleep(50);}
        break;
      }
      await sleep(100);
    }
  }catch{}
  console.log(JSON.stringify({browser:browserName,opened:true,extension:details,popupOpened,url:base+'/src/ui/index.html',profile},null,2));
  console.log(browserName+' remains open for your visual test. Close this separate window when finished.');
}finally{socket.close();}
