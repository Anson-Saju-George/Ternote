import assert from 'node:assert/strict';
import {resolveNativeFile} from '../src/native-file.js';
import {captureConversation,readCaptureAsset,cancelCapture} from '../src/extract.js';
import {PLATFORMS} from '../src/platforms.js';
import {presentationFixture} from './fixtures/presentation.mjs';

export async function nativeFileTests({evaluate,page,send,sleep,fixtureSessions,ui}) {
  const session=await page();
  fixtureSessions.set(session,'<!doctype html><html><head><title>Native fixture</title></head><body><main><article data-message-author-role="user" data-message-id="u"><p>Uploaded document</p><button id="uploaded">uploaded.docx</button></article><article data-message-author-role="assistant" data-message-id="a"><p>Generated presentation</p><button id="generated">generated.pptx</button><button id="danger">Delete chat</button></article></main></body></html>');
  await send('Fetch.enable',{patterns:[{urlPattern:'*'}]},session);
  await send('Page.navigate',{url:'https://chatgpt.com/c/native-fixture'},session);
  for(let i=0;i<40;i++){if(await evaluate(session,"document.title==='Native fixture'"))break;await sleep(50);}
  await evaluate(session,`window.resolveNative=${resolveNativeFile.toString()};window.originalOpen=window.open;window.originalClick=HTMLAnchorElement.prototype.click;
    window.dangerCount=0;document.getElementById('danger').onclick=()=>window.dangerCount++;
    window.setup=(id,mode='normal')=>{document.getElementById(id).onclick=()=>{
      document.getElementById('viewer')?.remove();const root=document.createElement('section');root.id='viewer';
      const title=document.createElement('h2');title.textContent=mode==='wrong'||mode==='cancel'?'another.pptx':document.getElementById(id).textContent;
      const download=document.createElement('button');download.setAttribute('aria-label','Download file');download.textContent='Download';
      download.onclick=()=>{window.downloadActions=(window.downloadActions||0)+1;window.open('/files/'+title.textContent);};
      const close=document.createElement('button');close.setAttribute('aria-label','Close');close.onclick=()=>root.remove();root.append(title,download,close);document.body.append(root);
      if(mode==='cancel')setTimeout(()=>document.getElementById(id).removeAttribute('data-ternote-file'),50);
    }};setup('uploaded');setup('generated');`);
  for(const [id,name] of [['uploaded','uploaded.docx'],['generated','generated.pptx']]) {
    const result=await evaluate(session,`(async()=>{document.getElementById('${id}').setAttribute('data-ternote-file','test:${id}');return resolveNative('test:${id}','${name}',location.href)})()`);
    assert.equal(result.url,'https://chatgpt.com/files/'+name);
    assert(await evaluate(session,"window.open===originalOpen&&HTMLAnchorElement.prototype.click===originalClick&&!document.getElementById('viewer')&&!window.__ternoteNativeFileBusy"));
  }
  await evaluate(session,"setup('generated','wrong');document.getElementById('generated').setAttribute('data-ternote-file','wrong');window.downloadActions=0");
  const wrong=await evaluate(session,"resolveNative('wrong','generated.pptx',location.href)");
  assert(wrong.error);assert.equal(await evaluate(session,'window.downloadActions'),0);
  await evaluate(session,"setup('generated','cancel');document.getElementById('generated').setAttribute('data-ternote-file','cancel')");
  // Cancellation occurs while waiting for a mismatched viewer, so no download is activated.
  const cancelled=await evaluate(session,"resolveNative('cancel','generated.pptx',location.href)");
  assert(cancelled.error);
  assert.equal(await evaluate(session,'window.downloadActions'),0);
  assert(await evaluate(session,"window.open===originalOpen&&HTMLAnchorElement.prototype.click===originalClick&&!window.__ternoteNativeFileBusy"));
  assert.equal(await evaluate(session,'window.dangerCount'),0);

  const pptx=Buffer.from(await presentationFixture()).toString('base64');
  await evaluate(session,`const textCard=document.createElement('button');textCard.id='textFile';textCard.textContent='notes.txt';document.querySelector('[data-message-author-role="assistant"]').append(textCard);
    setup('uploaded');setup('generated');setup('textFile');window.fetch=async url=>new Response(String(url).endsWith('notes.txt')?'Daily notes fixture':Uint8Array.from(atob('${pptx}'),c=>c.charCodeAt(0)),{headers:{'content-type':'application/octet-stream'}});
    window.chrome={runtime:{sendMessage:async m=>m.type==='native-file-request'?resolveNative(m.marker,m.name,m.url):undefined},storage:{onChanged:{addListener(){},removeListener(){}}}};`);
  const captured=await evaluate(session,'('+captureConversation.toString()+')('+JSON.stringify(PLATFORMS[0])+','+JSON.stringify({token:'native-pipeline',stream:true,nativeFiles:true,testTiming:{pollMs:60,edgeWait:160}})+')');
  assert.equal(captured.assets.length,3);assert(captured.assets.every(a=>!a.error&&a.size>0));
  assert.deepEqual(captured.assets.map(a=>a.kind),['docx','pptx','txt']);
  assert(!JSON.stringify(captured).includes('/files/'),'Signed/native URLs must not enter exported metadata.');
  const part=await evaluate(session,'('+readCaptureAsset.toString()+')('+JSON.stringify('native-pipeline')+','+JSON.stringify(captured.assets[1].id)+',0)');
  assert.equal(part.base64,pptx);assert(part.done);
  const textPart=await evaluate(session,'('+readCaptureAsset.toString()+')('+JSON.stringify('native-pipeline')+','+JSON.stringify(captured.assets[2].id)+',0)');
  assert.equal(Buffer.from(textPart.base64,'base64').toString(),'Daily notes fixture');
  assert.equal(await evaluate(session,"document.querySelectorAll('[data-ternote-file]').length"),0);
  await evaluate(session,'('+cancelCapture.toString()+')("native-pipeline")');
  // File verification runs in the real extension page too, not just Node's ArrayBuffer realm.
  const verified=await evaluate(ui,"(async()=>{const {verifyOfficeFile}=await import('../office-file.js');return verifyOfficeFile(Uint8Array.from(atob('"+pptx+"'),c=>c.charCodeAt(0)).buffer,'pptx')})()");
  assert.equal(verified.kind,'pptx');
  const fixture={title:'Native PPTX fixture',platform:'chatgpt',messages:[{role:'assistant',blocks:[{type:'asset',assetId:'ppt',name:'generated.pptx'}]}],assets:[{id:'ppt',name:'generated.pptx',kind:'pptx',size:Buffer.from(pptx,'base64').length,mime:'application/octet-stream'}]};
  await evaluate(ui,`window.savedScripts=chrome.scripting.executeScript;window.savedTabs=chrome.tabs.query;window.savedAnchorClick=HTMLAnchorElement.prototype.click;
    chrome.tabs.query=async()=>[{id:999,url:'https://chatgpt.com/c/native-ui'}];
    window.nativeCaptureCount=0;
    chrome.scripting.executeScript=async({func})=>{if(func.name==='captureConversation')window.nativeCaptureCount++;return [{result:func.name==='captureConversation'?${JSON.stringify(fixture)}:func.name==='readCaptureAsset'?{base64:'${pptx}',done:true,next:${Buffer.from(pptx,'base64').length}}:undefined}];};
    document.getElementById('preview').click();`);
  for(let i=0;i<80;i++){if(await evaluate(ui,"!document.getElementById('preview').disabled&&!!document.querySelector('#originalFiles button')"))break;await sleep(100);}
  assert(await evaluate(ui,"!document.getElementById('originalFiles').hidden&&document.querySelector('#originalFiles button').textContent.includes('generated.pptx')"));
  assert(await evaluate(ui,"document.getElementById('notice').textContent.includes('PPTX content is reflowed')"));
  await evaluate(ui,"document.getElementById('attachmentsToggle').click()");
  assert(await evaluate(ui,"!document.getElementById('attachmentPanel').hidden&&document.querySelector('#attachmentTypes input[value=pptx]').checked"));
  await evaluate(ui,"document.querySelector('#attachmentTypes input[value=pptx]').click();document.getElementById('preview').click()");
  for(let i=0;i<80;i++){if(await evaluate(ui,"!document.getElementById('preview').disabled"))break;await sleep(100);}
  assert.equal(await evaluate(ui,'window.nativeCaptureCount'),1,'Changing attachment selection must not recapture the conversation.');
  assert(await evaluate(ui,"(async()=>!(await(await fetch(document.getElementById('previewFrame').src)).text()).includes('FIRST SLIDE marker'))()"));
  await evaluate(ui,"document.querySelector('#attachmentTypes input[value=pptx]').click();document.getElementById('preview').click()");
  for(let i=0;i<80;i++){if(await evaluate(ui,"!document.getElementById('preview').disabled"))break;await sleep(100);}
  assert(await evaluate(ui,"(async()=>(await(await fetch(document.getElementById('previewFrame').src)).text()).includes('FIRST SLIDE marker'))()"));
  await evaluate(ui,"HTMLAnchorElement.prototype.click=function(){window.savedOriginalUrl=this.href;window.savedOriginalName=this.download;};document.querySelector('#originalFiles button').click()");
  assert.equal(await evaluate(ui,'window.savedOriginalName'),'generated.pptx');
  const original=await evaluate(ui,"(async()=>{const b=new Uint8Array(await(await fetch(window.savedOriginalUrl)).arrayBuffer());return btoa(String.fromCharCode(...b))})()");
  assert.equal(original,pptx);
  await evaluate(ui,"document.getElementById('redact').value='private';document.getElementById('redact').dispatchEvent(new Event('input'))");
  assert(await evaluate(ui,"document.querySelector('#originalFiles button').disabled"));
  await evaluate(ui,"document.getElementById('redact').value='';document.getElementById('redact').dispatchEvent(new Event('input'));HTMLAnchorElement.prototype.click=window.savedAnchorClick;chrome.scripting.executeScript=window.savedScripts;chrome.tabs.query=window.savedTabs;document.getElementById('preview').click()");
  for(let i=0;i<80;i++){if(await evaluate(ui,"!document.getElementById('preview').disabled&&document.getElementById('originalFiles').hidden"))break;await sleep(100);}
  assert(await evaluate(ui,"document.getElementById('originalFiles').hidden"));
  console.log('PPTX Save original preserves bytes, reports reflow limits, respects redaction and clears on conversation change.');
  console.log('Native uploaded/generated cards: viewer matching, method restoration, wrong-file rejection, byte transfer and Office verification passed.');
}
