import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { captureConversation, cancelCapture, readCaptureAsset } from '../src/extract.js';
import { PLATFORMS } from '../src/platforms.js';
export async function advancedTests({ ui, evaluate, page, send, sleep, fixtureSessions, output }) {
  // Exercise the real module worker and the actual PDF preview, not an HTML print substitute.
  await evaluate(ui,"window.__printCalls=0;window.print=()=>{window.__printCalls++;throw Error('No print popup allowed')};const originalCreateURL=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==='application/pdf')window.__downloadBlob=blob;return originalCreateURL(blob)};document.getElementById('format').value='pdf';document.getElementById('format').dispatchEvent(new Event('change'));document.getElementById('preview').click()");
  for(let i=0;i<150;i++){if(await evaluate(ui,"document.getElementById('pageLabel').textContent.includes(' / ')||document.getElementById('status').classList.contains('error')"))break;await sleep(100);}
  assert(await evaluate(ui,"document.getElementById('pageLabel').textContent.includes(' / ')"),'Actual PDF preview failed: '+await evaluate(ui,"document.getElementById('status').textContent"));
  for(let i=0;i<100;i++){if(await evaluate(ui,"!document.getElementById('export').disabled"))break;await sleep(100);}
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:output,eventsEnabled:true});
  await evaluate(ui,"document.getElementById('filename').value='edge-formatted-test';document.getElementById('export').click()");
  for(let i=0;i<80;i++){if(await evaluate(ui,"!!window.__downloadBlob"))break;await sleep(100);}
  assert.equal(await evaluate(ui,"window.__printCalls"),0);
  let encoded=await evaluate(ui,"(async()=>{const b=new Uint8Array(await window.__downloadBlob.arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s)})()");
  let generatedPdf=Buffer.from(encoded,'base64');
  assert.equal(generatedPdf.subarray(0,5).toString(),'%PDF-');
  for(let i=0;i<80;i++){try{assert((await readFile(join(output,'edge-formatted-test.pdf'))).equals(generatedPdf));break;}catch(error){if(i===79)throw error;await sleep(100);}}
  const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},ui);
  await writeFile(join(output,'pdf-preview.png'),Buffer.from(png.data,'base64'));
  const pagePng=await evaluate(ui,"document.getElementById('pdfCanvas').toDataURL('image/png').split(',')[1]");
  await writeFile(join(output,'pdf-page.png'),Buffer.from(pagePng,'base64'));
  const pdfInspection=await evaluate(ui,"(async()=>{const {openPdf}=await import('../assets.js');const task=await openPdf(await window.__downloadBlob.arrayBuffer());const p=await task.promise;const text=[];for(let i=1;i<=p.numPages;i++)text.push((await(await p.getPage(i)).getTextContent()).items.map(x=>x.str).join(' '));const n=p.numPages;await task.destroy();return {pages:n,text:text.join(' ')}})()");
  assert(pdfInspection.text.includes('Basil'));assert(pdfInspection.text.includes('ChatGPT'));
  assert(pdfInspection.pages>=1);
  console.log('Direct PDF download, real PDF preview, searchable text, and no print popup passed ('+pdfInspection.pages+' pages).');
  assert(pdfInspection.pages<=2,'Compact boxed fixture should remain at most two pages.');

  async function fixture(html) {
    const session=await page();fixtureSessions.set(session,html);
    await send('Fetch.enable',{patterns:[{urlPattern:'*'}]},session);
    await send('Page.navigate',{url:'https://chatgpt.com/synthetic'},session);
    for(let i=0;i<60;i++){if(await evaluate(session,"document.readyState==='complete'&&document.title==='Advanced fixture'"))break;await sleep(50);}
    return session;
  }
  const base='<!doctype html><html><head><meta charset="utf-8"><title>Advanced fixture</title><style>main{height:240px;overflow:auto;overflow-anchor:none}article{height:100px;box-sizing:border-box}body{margin:0}</style></head><body>';
  const options={testTiming:{pollMs:20,edgeWait:100}};
  const p=PLATFORMS[0];
  const invoke='('+captureConversation.toString()+')('+JSON.stringify(p)+','+JSON.stringify(options)+')';
  const lazy=await fixture(base+'<main id="scroll"></main><script>const root=document.getElementById("scroll");let earliest=48;function add(){const old=root.scrollHeight;const frag=document.createDocumentFragment();for(let i=Math.max(0,earliest-12);i<earliest;i++){const el=document.createElement("article");el.dataset.messageId="lazy-"+i;el.dataset.messageAuthorRole=i%2?"assistant":"user";el.innerHTML="<p>message "+i+"</p>";frag.append(el)}earliest=Math.max(0,earliest-12);root.prepend(frag);root.scrollTop+=root.scrollHeight-old}add();root.scrollTop=root.scrollHeight;let pending=false;root.addEventListener("scroll",()=>{if(root.scrollTop===0&&earliest>0&&!pending){pending=true;root.setAttribute("aria-busy","true");setTimeout(()=>{add();pending=false;root.setAttribute("aria-busy","false")},250)}})</script></body></html>');
  const lazyResult=await evaluate(lazy,invoke);
  assert.equal(lazyResult.messages.length,48);
  assert.deepEqual(lazyResult.messages.map(m=>m.blocks[0].text),Array.from({length:48},(_,i)=>'message '+i));
  console.log('Lazy earlier history with delayed loading and order preservation passed.');

  const virtual=await fixture(base+'<main id="scroll"><div id="space" style="height:20000px;position:relative"></div></main><script>const root=document.getElementById("scroll"),space=document.getElementById("space");function draw(){const start=Math.floor(root.scrollTop/100);space.replaceChildren();for(let i=start;i<Math.min(200,start+6);i++){const el=document.createElement("article");el.dataset.messageId="virtual-"+i;el.dataset.messageAuthorRole=i%2?"assistant":"user";el.style="position:absolute;left:0;right:0;top:"+(i*100)+"px";el.innerHTML="<p>"+(i===5||i===6?"identical repeated message":"message "+i)+"</p>";space.append(el)}}root.addEventListener("scroll",draw);root.scrollTop=17000;draw()</script></body></html>');
  const virtualResult=await evaluate(virtual,invoke);
  assert.equal(virtualResult.messages.length,200);
  assert.equal(virtualResult.messages[0].blocks[0].text,'message 0');
  assert.equal(virtualResult.messages[199].blocks[0].text,'message 199');
  assert.equal(virtualResult.messages.filter(m=>m.blocks[0].text==='identical repeated message').length,2);
  assert.equal(await evaluate(virtual,"document.getElementById('scroll').scrollTop"),17000);
  console.log('200-message virtualized chat, repeated messages, and scroll restoration passed.');

  const collapse=await fixture(base+'<main><article data-message-id="one" data-message-author-role="assistant"><p>Hello</p><details><summary>Details</summary><p>Hidden expandable answer</p></details><button aria-expanded="false" aria-controls="extra" onclick="document.getElementById(\'extra\').hidden=!document.getElementById(\'extra\').hidden;this.setAttribute(\'aria-expanded\',String(!document.getElementById(\'extra\').hidden))">Show more</button><div id="extra" hidden><p>More answer</p></div><button onclick="window.dangerClicked=true">Delete chat</button></article></main></body></html>');
  await evaluate(collapse,"document.querySelector('article').setAttribute('data-message-model-slug','fixture-v2');document.querySelector('article').setAttribute('data-reasoning-effort','high');const menu=document.createElement('button');menu.setAttribute('aria-expanded','false');menu.textContent='More actions';document.querySelector('article').append(menu)");
  const collapseResult=await evaluate(collapse,invoke);
  assert(JSON.stringify(collapseResult).includes('Hidden expandable answer'));assert(JSON.stringify(collapseResult).includes('More answer'));
  assert.equal(await evaluate(collapse,"document.querySelector('details').open"),false);assert.equal(await evaluate(collapse,"!!window.dangerClicked"),false);
  assert.equal(collapseResult.model,'fixture-v2');assert.equal(collapseResult.effort,'high');
  assert(!collapseResult.capture.warnings.some(w=>/expand|collapsed/.test(w)),'Unrelated collapsed menus must not imply missing chat content.');

  const cancelSession=await fixture(base+'<main aria-busy="true"><article data-message-author-role="user"><p>Never ending load</p></article></main></body></html>');
  await evaluate(cancelSession,'void(window.pendingCapture='+invoke+'.then(()=>({ok:true}),e=>({error:e.message})))');
  await sleep(80);await evaluate(cancelSession,'('+cancelCapture.toString()+')()');
  assert.match((await evaluate(cancelSession,'window.pendingCapture')).error,/cancelled/);
  assert.equal(await evaluate(cancelSession,"!!globalThis.__personalExportCapture"),false);
  console.log('Safe content expansion, cancellation, and cleanup passed.');
  const panels=await fixture(base+'<main><article data-message-author-role="user" data-message-id="panels"><p>Attached artifacts</p></article><div data-testid="artifact-panel"><div data-artifact-content><p>Nested artifact one</p></div></div><div data-artifact-content><p>Artifact two</p></div></main></body></html>');
  const panelResult=await evaluate(panels,invoke);
  assert.equal(panelResult.messages.length,3,'Nested panels are read once and independent anonymous panels have distinct identities.');
  assert.deepEqual(panelResult.messages.slice(1).map(m=>m.blocks[0].text),['Nested artifact one','Artifact two']);
  console.log('Distinct anonymous artifacts and nested panel deduplication settle without capture loops.');
  encoded=await evaluate(ui,"(async()=>{const {createPdf}=await import('../pdf.js');const blob=await createPdf({title:'Multi-page attachment',messages:[{role:'assistant',blocks:[{type:'code',text:Array.from({length:180},(_,i)=>'Long code row '+i).join('\\n')}]}]},'light');const b=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s)})()");
  generatedPdf=Buffer.from(encoded,'base64');

  const longPdf=await evaluate(ui,"(async()=>{const {openPdf}=await import('../assets.js');const data=Uint8Array.from(atob("+JSON.stringify(encoded)+"),c=>c.charCodeAt(0));const task=await openPdf(data.buffer);const pdf=await task.promise;let text='';const bodyPages=[];for(let i=1;i<=pdf.numPages;i++){const t=(await(await pdf.getPage(i)).getTextContent()).items.map(x=>x.str).join(' ').replace(/\\s+/g,' ');text+=t;bodyPages.push(/Long code row/.test(t))}await task.destroy();return {sample:text.slice(0,240),rows:[...text.matchAll(/Long code row \\d+/g)].length,first:text.includes('Long code row 0'),last:text.includes('Long code row 179'),bodyPages}})()");
  assert.equal(longPdf.rows,180,'Boxed, paginated code must retain every line exactly once. Synthetic output: '+longPdf.sample);
  assert(longPdf.first&&longPdf.last&&longPdf.bodyPages.every(Boolean),'No empty trailing page or clipped code.');
  const darkPdf=await evaluate(ui,"(async()=>{const {createPdf}=await import('../pdf.js');const {openPdf}=await import('../assets.js');const blob=await createPdf({platform:'chatgpt',title:'Dark-theme fixture',model:'Fixture model',effort:'high',messages:[{role:'user',blocks:[{type:'paragraph',text:'Question marker'}]},{role:'assistant',blocks:[{type:'paragraph',text:'Answer marker'}]}]},'dark');const task=await openPdf(await blob.arrayBuffer());const pdf=await task.promise;const page=await pdf.getPage(1);const viewport=page.getViewport({scale:1});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport,intent:'print'}).promise;const png=canvas.toDataURL('image/png').split(',')[1];const text=(await page.getTextContent()).items.map(x=>x.str).join(' ');await task.destroy();return {png,text}})()");
  assert(darkPdf.text.includes('Question marker')&&darkPdf.text.includes('Answer marker'));
  await writeFile(join(output,'pdf-dark-page.png'),Buffer.from(darkPdf.png,'base64'));
  console.log('All 180 boxed code lines, no empty trailing pages, and dark PDF raster rendering passed.');

  const zip=new JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX attachment text &lt;script&gt; stays inert</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell A</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>');
  const docx=await zip.generateAsync({type:'nodebuffer'});
  console.log('DOCX fixture generated; testing attachment discovery.');
  const imageData=await evaluate(ui,"(()=>{const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle='#356b50';ctx.fillRect(0,0,120,80);return canvas.toDataURL('image/png')})()");
  const attachments=await fixture(base+'<main><article data-message-id="attached" data-message-author-role="user"><p>Attached documents</p><img src="'+imageData+'" alt="Green image"><a download="attached.pdf" href="data:application/pdf;base64,'+encoded+'">attached.pdf</a></article><div data-artifact-content><pre><code>const artifact = 42;</code></pre></div></main></body></html>');
  await evaluate(attachments,"const image=document.querySelector('img');const button=document.createElement('button');button.setAttribute('aria-label','Open image');image.replaceWith(button);button.append(image)");
  const token='attachment-test';
  const captured=await evaluate(attachments,'('+captureConversation.toString()+')('+JSON.stringify(p)+','+JSON.stringify({...options,stream:true,token})+')');
  console.log('Attachment discovery returned '+captured.assets.length+' resources.');
  assert.equal(captured.assets.length,2);assert.equal(captured.capture.messageCount,2);
  const pdfMeta=captured.assets.find(a=>a.kind==='pdf');
  let offset=0,parts=[];
  while(true){const part=await evaluate(attachments,'('+readCaptureAsset.toString()+')('+JSON.stringify(token)+','+JSON.stringify(pdfMeta.id)+','+offset+')');parts.push(Buffer.from(part.base64,'base64'));offset=part.next;if(part.done)break;}
  assert(Buffer.concat(parts).equals(generatedPdf));
  await evaluate(attachments,'('+cancelCapture.toString()+')('+JSON.stringify(token)+')');
  console.log('Attachment byte transfer passed; rendering PDF and DOCX.');
  const rendered=await evaluate(ui,"(async()=>{const {renderAsset,documentBlocks}=await import('../assets.js');const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;const pdf=await renderAsset({id:'pdf',name:'attached.pdf',kind:'pdf',mime:'application/pdf'},bytes("+JSON.stringify(encoded)+"));const docx=await renderAsset({id:'docx',name:'attached.docx',kind:'docx',mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},bytes("+JSON.stringify(docx.toString('base64'))+"));const img=await renderAsset({id:'image',name:'Green image',kind:'image',mime:'image/png'},bytes("+JSON.stringify(imageData.split(',')[1])+"));const cleaned=await documentBlocks('<script>BAD</script><p>Safe</p><img src=\"https://tracker.test/x\"><a href=\"javascript:alert(1)\">Link text</a>');window.__renderedAssets=[pdf,docx,img];return {pdfPages:pdf.pages.length,docxText:JSON.stringify(docx.blocks),image:img.data.startsWith('data:image/jpeg;'),cleaned:JSON.stringify(cleaned)}})()");
  assert(rendered.pdfPages>=2,'All pages of a genuinely multi-page attachment must render');assert(rendered.docxText.includes('DOCX attachment text'));assert(rendered.docxText.includes('Cell A'));assert(rendered.image);
  assert(!rendered.cleaned.includes('BAD'));assert(!rendered.cleaned.includes('tracker.test'));assert(!rendered.cleaned.includes('javascript:'));
  const combined=await evaluate(ui,"(async()=>{const {createPdf}=await import('../pdf.js');const {openPdf}=await import('../assets.js');const c={title:'Attachments',messages:[{role:'user',blocks:window.__renderedAssets.map(a=>({type:'asset',assetId:a.id,name:a.name}))}],assets:window.__renderedAssets};const blob=await createPdf(c,'light');const t=await openPdf(await blob.arrayBuffer());const p=await t.promise;let text='';for(let i=1;i<=p.numPages;i++)text+=(await(await p.getPage(i)).getTextContent()).items.map(x=>x.str).join(' ');const pages=p.numPages;await t.destroy();return {pages,text}})()");
  assert(combined.text.includes('DOCX attachment text'));assert(combined.pages>=rendered.pdfPages);
  console.log('Image bytes, PDF attachment pages, DOCX conversion, artifact capture, sanitizer, and combined PDF passed.');
}
