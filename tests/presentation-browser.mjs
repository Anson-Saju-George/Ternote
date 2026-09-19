import assert from 'node:assert/strict';
import {presentationFixture} from './fixtures/presentation.mjs';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function presentationTests({ui,evaluate,output}) {
  const base64=Buffer.from(await presentationFixture()).toString('base64');
  const result=await evaluate(ui,`(async()=>{
    const {renderAsset,openPdf,rasterize}=await import('../assets.js');
    const {presentationBlocks}=await import('../pptx.js');
    const {prepareConversation,htmlDocument}=await import('../exporters.js');
    const {createPdf}=await import('../pdf.js');
    const data=Uint8Array.from(atob('${base64}'),c=>c.charCodeAt(0)).buffer;
    // Parser regression only: reflow is no longer called by the product's export path.
    const deck={id:'deck',name:'Fixture.pptx',kind:'pptx',status:'ready',...await presentationBlocks(data,{rasterize})};
    const c={title:'Inline presentation',platform:'chatgpt',messages:[{role:'user',blocks:[{type:'paragraph',text:'BEFORE DECK marker'},{type:'asset',assetId:'deck',name:deck.name},{type:'paragraph',text:'AFTER DECK marker'}]}],assets:[deck]};
    const prepared=prepareConversation(c),html=htmlDocument(prepared);
    const blob=await createPdf(prepared),task=await openPdf(await blob.arrayBuffer()),pdf=await task.promise;let text='',png;
    try{for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);text+=(await page.getTextContent()).items.map(item=>item.str).join(' ')+' ';
      if(i===1){const viewport=page.getViewport({scale:1.2}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport,intent:'print'}).promise;png=canvas.toDataURL('image/png').split(',')[1];canvas.width=canvas.height=0;}page.cleanup();}}finally{await task.destroy();}
    const redacted=prepareConversation(c,{redact:'FIRST'});
    const excluded=prepareConversation(c,{attachmentTypes:[]});
    const plain={};for(const kind of ['txt','md','csv','json','html','xml','log','yaml','sql']){
      const a=await renderAsset({id:kind,name:'example.'+kind,kind},new TextEncoder().encode('<script>NEVER EXECUTE</script> daily text').buffer);
      plain[kind]=a.status==='ready'&&a.sourceKind===kind&&a.blocks[0].text.includes('daily text');
    }
    const utf16=await renderAsset({kind:'txt',name:'windows.txt'},new Uint8Array([255,254,65,0,66,0]).buffer);plain.utf16=utf16.blocks[0].text==='AB';
    return {text,html,plain,png,status:deck.status,slides:deck.slideCount,images:deck.blocks.filter(b=>b.type==='image').length,
      tables:deck.blocks.filter(b=>b.type==='table').length,notes:deck.blocks.filter(b=>b.type==='attachment-note').map(b=>b.text),
      redacted:JSON.stringify(redacted),excluded:JSON.stringify(excluded)};
  })()`);
  assert.equal(result.status,'ready');assert.equal(result.slides,2);assert.equal(result.images,1);assert.equal(result.tables,1);
  await writeFile(join(output,'pptx-inline.png'),Buffer.from(result.png,'base64'));
  const markers=['BEFORE DECK marker','FIRST SLIDE marker','SECOND SLIDE marker','AFTER DECK marker'];
  for(const output of [result.text,result.html]) {
    let at=-1;for(const marker of markers){const next=output.indexOf(marker);assert(next>at,'Attachment flow must retain '+marker);at=next;}
  }
  assert(result.notes.some(n=>n.includes('chart')));assert(result.notes.some(n=>n.includes('Linked')));
  assert(!result.redacted.includes('FIRST'));assert(!result.redacted.includes('data:image/'));
  assert(!result.excluded.includes('FIRST SLIDE'));assert(Object.values(result.plain).every(Boolean));
  const unsafe=Buffer.from(await presentationFixture({unsafe:true})).toString('base64');
  assert(await evaluate(ui,`(async()=>{try{const {presentationBlocks}=await import('../pptx.js');await presentationBlocks(Uint8Array.from(atob('${unsafe}'),c=>c.charCodeAt(0)).buffer,{});return false;}catch(e){return e.message.includes('declarations');}})()`));
  assert(await evaluate(ui,"(async()=>{try{const {renderAsset}=await import('../assets.js');await renderAsset({kind:'pptx'},new ArrayBuffer(8));return false;}catch(e){return e.message.includes('Original slide previews are required');}})()"));
  console.log('Legacy reflow parser regression and inert text files passed; product rejects reflow as a substitute for original slides.');
}
