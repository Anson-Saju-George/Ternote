import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {captureConversation} from '../src/extract.js';
import {PLATFORMS} from '../src/platforms.js';
import {demoConversation} from '../tests/fixtures/demo.js';
import {advancedTests} from '../tests/browser-scenarios.mjs';
import {nativeFileTests} from '../tests/native-files.mjs';
const root=resolve(import.meta.dirname,'..'),output=join(root,'test-output');
await mkdir(output,{recursive:true});
const candidates=[process.env.BROWSER_PATH,'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].filter(Boolean);
let browserPath;
for(const path of candidates){try{await access(path);browserPath=path;break;}catch{}}
assert(browserPath,'No browser found. Set BROWSER_PATH.');
const profile=await mkdtemp(join(output,'browser-'));
const browser=spawn(browserPath,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-sync','--disable-component-update','--disable-default-apps','--remote-debugging-port=0','--user-data-dir='+profile,'--disable-extensions-except='+join(root,'dist'),'--load-extension='+join(root,'dist'),'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let socket,next=0;const pending=new Map(),listeners=new Map();
async function connect(){
  let endpoint;
  for(let i=0;i<150;i++){try{const [port,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split(/\r?\n/);endpoint='ws://127.0.0.1:'+port+path;break;}catch{await sleep(100);}}
  assert(endpoint,'Browser did not expose its isolated debug endpoint.');
  socket=new WebSocket(endpoint);
  await new Promise((res,rej)=>{socket.onopen=res;socket.onerror=rej;});
  socket.onmessage=event=>{
    const m=JSON.parse(event.data);
    if(m.id){const item=pending.get(m.id);if(!item)return;pending.delete(m.id);clearTimeout(item.timer);m.error?item.reject(new Error(m.error.message)):item.resolve(m.result);}
    else for(const listener of listeners.get(m.method)||[])listener(m.params,m.sessionId);
  };
  socket.onclose=()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error('Isolated browser closed.'));}pending.clear();};
}
function send(method,params={},sessionId){
  return new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timed out: '+method));},90000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
}
async function page(url='about:blank'){
  const {targetId}=await send('Target.createTarget',{url});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Page.enable',{},sessionId);await send('Runtime.enable',{},sessionId);
  return sessionId;
}
async function evaluate(session,expression){
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},session);
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
try{
  await connect();
  let worker;
  for(let i=0;i<80;i++){worker=(await send('Target.getTargets')).targetInfos.find(t=>t.type==='service_worker'&&t.url.includes('/src/background.js'));if(worker)break;await sleep(100);}
  assert(worker,'Unpacked extension did not load.');
  const origin=new URL(worker.url).origin;
  // URL.origin for extension schemes may be null in Node.
  const extensionBase=worker.url.slice(0,worker.url.indexOf('/src/background.js'));
  const ui=await page(extensionBase+'/src/ui/index.html');
  for(let i=0;i<80;i++){if(await evaluate(ui,"document.documentElement.dataset.ready === 'true'"))break;await sleep(100);}
  assert(await evaluate(ui,"!document.querySelector('.conversation') && !document.getElementById('demo') && !document.getElementById('capture')"),'Demo card and sample controls are removed');
  const apiState=await evaluate(ui,"(async()=>({permissions:await chrome.permissions.getAll(),storage:await chrome.storage.local.get(null)}))()");
  assert.equal(apiState.permissions.origins.length,0,'No site host access should be granted initially');
  assert(!JSON.stringify(apiState.storage).includes('Basil'),'Demo conversation must not enter storage');
  assert.equal((await evaluate(ui,"chrome.scripting.getRegisteredContentScripts()")).length,0,'No platform scripts registered without consent');
  await evaluate(ui,"document.getElementById('preview').click()");
  for(let i=0;i<30;i++){if(await evaluate(ui,"document.getElementById('status').classList.contains('error')"))break;await sleep(50);}
  assert(await evaluate(ui,"document.getElementById('status').textContent.includes('Open ChatGPT')"),'No synthetic conversation is loaded into the product');
  // Test-only API doubles exercise capture-on-action without adding a demo path to production.
  await evaluate(ui,"chrome.tabs.query=async()=>[{id:999,url:'https://chatgpt.com/c/synthetic'}];chrome.permissions.contains=async()=>true;chrome.scripting.executeScript=async()=>[{result:"+JSON.stringify(demoConversation())+"}]");
  await evaluate(ui,"document.getElementById('preview').click()");
  for(let i=0;i<40;i++){if(await evaluate(ui,"!!document.getElementById('previewFrame').contentDocument?.querySelector('table')"))break;await sleep(100);}
  assert(await evaluate(ui,"!!document.getElementById('previewFrame').contentDocument.querySelector('table')"),'Preview renders a table');
  assert(await evaluate(ui,"document.getElementById('previewFrame').contentDocument.body.textContent.includes('നമസ്കാരം')"));
  await evaluate(ui,"document.getElementById('closePreview').click();document.getElementById('range').value='assistant';document.getElementById('range').dispatchEvent(new Event('change'));document.getElementById('preview').click()");
  await sleep(150);
  assert.equal(await evaluate(ui,"document.getElementById('previewFrame').contentDocument.querySelectorAll('section').length"),2);
  await evaluate(ui,"document.getElementById('closePreview').click();document.getElementById('range').value='all';document.getElementById('range').dispatchEvent(new Event('change'))");
  await send('Emulation.setDeviceMetricsOverride',{width:420,height:600,deviceScaleFactor:1,mobile:false},ui);
  assert(await evaluate(ui,"document.getElementById('export').getBoundingClientRect().bottom <= 600"),'Primary export action must be visible in a 600px popup');
  const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},ui);
  await writeFile(join(output,'popup.png'),Buffer.from(png.data,'base64'));
  const fixtureSessions=new Map();
  listeners.set('Fetch.requestPaused',[(event,session)=>{
    const html=fixtureSessions.get(session);
    if(html)void send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from(html).toString('base64')},session).catch(()=>{});
  }]);
  for(const p of process.argv.includes('--pdf-only')?[]:PLATFORMS){
    const session=await page();
    const userTag=p.id==='gemini'?'user-query':'article',assistantTag=p.id==='gemini'?'model-response':'article';
    const userAttr=p.id==='claude'?'data-testid="user-message"':'data-message-author-role="user"';
    const aiAttr=p.id==='claude'?'data-testid="assistant-message"':'data-message-author-role="assistant"';
    const fixture='<!doctype html><html><head><title>Fixture</title></head><body><main><'+userTag+' '+userAttr+'><p>hello नमस्ते</p><input value="SECRET"><p hidden>HIDDEN</p></'+userTag+'><'+assistantTag+' '+aiAttr+'><h2>Answer</h2><p>Visible content</p><pre><code class="language-js">const answer = 42;</code></pre><table><tr><th>A</th><th>B</th></tr><tr><td>one</td><td>two</td></tr></table><button>CONTROL</button></'+assistantTag+'></main></body></html>';
    fixtureSessions.set(session,fixture);
    await send('Fetch.enable',{patterns:[{urlPattern:'*'}]},session);
    await send('Page.navigate',{url:'https://'+p.host+'/synthetic?secret=do-not-export#private'},session);
    for(let i=0;i<40;i++){if(await evaluate(session,"document.title==='Fixture'"))break;await sleep(100);}
    const result=await evaluate(session,'('+captureConversation.toString()+')('+JSON.stringify(p)+')');
    assert.equal(result.messages.length,2,p.id+' message count');
    assert.deepEqual(result.messages.map(m=>m.role),['user','assistant']);
    assert(result.messages[1].blocks.some(b=>b.type==='code'));
    assert(result.messages[1].blocks.some(b=>b.type==='table'));
    assert(!JSON.stringify(result).includes('HIDDEN'));
    assert(!JSON.stringify(result).includes('CONTROL'));
    assert(!JSON.stringify(result).includes('SECRET'));
    assert(!result.sourceUrl.includes('?'));
    console.log('Synthetic DOM capture passed: '+p.name);
  }
  await nativeFileTests({ui,evaluate,page,send,sleep,fixtureSessions});
  await advancedTests({ui,evaluate,page,send,sleep,fixtureSessions,output});
  console.log('Extension load, demo removal, capture-on-action, default permissions, storage privacy, preview, selection, Unicode and three synthetic adapters passed.');
  console.log('Screenshot: '+join(output,'popup.png'));
}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  await sleep(300);if(browser.exitCode===null)browser.kill();
  // Retained only inside ignored test-output for inspecting failures; user profile never opened.
}
