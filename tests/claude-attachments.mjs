import assert from 'node:assert/strict';
import {captureConversation} from '../src/extract.js';
import {resolveNativeFile} from '../src/native-file.js';
import {PLATFORMS} from '../src/platforms.js';

export async function claudeAttachmentTests({ui,evaluate,page,send,sleep,fixtureSessions}) {
  for(const platform of PLATFORMS.slice(0,2)) {
    const session=await page();
    const attrs=role=>platform.id==='claude'?'data-testid="'+role+'-message"':'data-message-author-role="'+role+'"';
    fixtureSessions.set(session,'<!doctype html><title>Attachment classification</title><nav><button>Load more history</button></nav><main><button id="history" aria-label="Load earlier messages">Earlier</button><article data-message-uuid="u" '+attrs('user')+'><p>Uploaded</p><a download="uploaded.md" href="/files/uploaded.md">uploaded.md</a><button id="file">uploaded.docx</button></article><article data-message-uuid="a" '+attrs('assistant')+'><p>Generated</p><a download="generated.md" href="/files/generated.md">generated.md</a><a download="page.html" href="/files/page.html">page.html</a><a href="https://example.com/article.html">Website</a><a href="https://github.com/example/repo/blob/main/SKILL.md">SKILL.md</a><img alt="visualize icon" src="/icon.png"></article></main>');
    await send('Fetch.enable',{patterns:[{urlPattern:'*'}]},session);
    await send('Page.navigate',{url:'https://'+platform.host+'/chat/fixture'},session);
    for(let i=0;i<60;i++){if(await evaluate(session,"document.title==='Attachment classification'"))break;await sleep(50);}
    await evaluate(session,`window.fetched=[];window.fetch=async url=>{fetched.push(url);return new Response(url.endsWith('.html')?'<h1>Attached HTML</h1>':'# Attached Markdown',{headers:{'content-type':'text/plain'}})};document.getElementById('history').onclick=()=>document.getElementById('history').remove();`);
    const captured=await evaluate(session,'('+captureConversation.toString()+')('+JSON.stringify(platform)+',{testTiming:{pollMs:20,edgeWait:100}})');
    assert.equal(captured.messages.length,2);
    assert.deepEqual(captured.assets.map(a=>a.kind),['md','docx','md','html']);
    assert(captured.assets.filter(a=>a.kind!=='docx').every(a=>!a.error));
    assert.equal((await evaluate(session,'fetched')).length,3);
    assert(!captured.capture.warnings.some(w=>/stable IDs|load-history/.test(w)));
    const text=JSON.stringify(captured.messages);
    assert(text.includes('https://example.com/article.html'));
    assert(text.includes('https://github.com/example/repo/blob/main/SKILL.md'));
    await evaluate(session,`document.getElementById('file').setAttribute('data-ternote-file','native-test');document.getElementById('file').onclick=()=>{const section=document.createElement('section');section.innerHTML='<h2>uploaded.docx</h2><button aria-label="Download file">Download</button><button aria-label="Close">Close</button>';section.querySelector('[aria-label="Download file"]').onclick=()=>window.open('/files/uploaded.docx');section.querySelector('[aria-label="Close"]').onclick=()=>section.remove();document.body.append(section)}`);
    const result=await evaluate(session,'('+resolveNativeFile.toString()+')("native-test","uploaded.docx",location.href)');
    assert.equal(result.url,'https://'+platform.host+'/files/uploaded.docx');
    for(const name of ['uploaded.pdf','generated.pdf','generated.docx','uploaded.pptx','generated.pptx','generated.md']) {
      await evaluate(session,`document.getElementById('file').textContent=${JSON.stringify(name)};document.getElementById('file').onclick=()=>{const section=document.createElement('section');const title=document.createElement('h2');title.textContent=${JSON.stringify(name)};const download=document.createElement('button');download.setAttribute('aria-label','Download');download.onclick=()=>window.open('/files/'+title.textContent);const close=document.createElement('button');close.setAttribute('aria-label','Close');close.onclick=()=>section.remove();section.append(title,download,close);document.body.append(section)}`);
      const file=await evaluate(session,'('+resolveNativeFile.toString()+')('+JSON.stringify('native-test')+','+JSON.stringify(name)+',location.href)');
      assert.equal(file.url,'https://'+platform.host+'/files/'+name);
    }
    await evaluate(session,'globalThis.__personalExportCapture?.dispose()');
  }
  const rendered=await evaluate(ui,`(async()=>{const {renderAsset}=await import('../assets.js');const buffer=new TextEncoder().encode('<h1>Safe title</h1><p>Readable body</p><script>window.evil=1</script><iframe src="https://example.com"></iframe>').buffer;return renderAsset({kind:'html',name:'test.html'},buffer)})()`);
  assert.equal(rendered.sourceKind,'html');
  assert(JSON.stringify(rendered.blocks).includes('Readable body'));
  assert(!JSON.stringify(rendered.blocks).includes('window.evil'));
  console.log('Claude/ChatGPT attachment classification, Markdown files, scoped history, native viewer download, and inert HTML passed.');
}
