import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfDefinition, fontRuns } from '../src/pdf-layout.js';
import { prepareConversation, htmlDocument } from '../src/exporters.js';
import { demoConversation } from './fixtures/demo.js';
const image = 'data:image/png;base64,aGVsbG8=';
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(nodes)];
}
test('PDF has an original paginated layout with readable text and metadata', () => {
  const def = pdfDefinition(demoConversation());
  assert.equal(def.pageSize,'A4'); assert.deepEqual(def.pageMargins,[52,50,52,52]);
  assert(def.styles.title.fontSize > def.defaultStyle.fontSize);
  assert(def.content.some(n=>n.table?.headerRows===1));
  assert(nodes(def.content).some(n=>n.style==='speaker'));
  assert.equal(def.footer(2,10).columns[1].text,'2 / 10');
});
test('long code is split into rows, and wide tables never overflow', () => {
  const c=demoConversation();
  c.messages=[{role:'assistant',blocks:[{type:'code',text:Array.from({length:300},(_,i)=>'line '+i).join('\n')},{type:'table',rows:[Array(10).fill('Header'),Array(10).fill('Cell')]}]}];
  const def=pdfDefinition(c);
  assert(nodes(def.content).some(n=>n.table?.body.length===301));
  assert(nodes(def.content).some(n=>n.stack?.length===10));
});
test('PDF accepts only embedded raster images, not URLs or executable SVG',()=>{
  const c=demoConversation();c.messages=[{role:'user',blocks:[{type:'asset',assetId:'a',name:'test'}]}];
  for(const data of ['https://tracker.test/a.png','data:image/svg+xml;base64,AAAA','javascript:alert(1)']){
    c.assets=[{id:'a',status:'ready',kind:'image',data}];assert.equal(Object.keys(pdfDefinition(c).images).length,0);
    assert(!htmlDocument(c).includes('src="'+data));
  }
  c.assets=[{id:'a',status:'ready',kind:'image',data:image,width:10,height:10}];assert.equal(Object.keys(pdfDefinition(c).images).length,1);
});
test('only assets belonging to selected messages leave the exporter',()=>{
  const c=demoConversation();c.messages[0].blocks.push({type:'asset',assetId:'a',name:'Private image'});
  c.assets=[{id:'a',status:'ready',kind:'image',data:image}];
  assert.equal(prepareConversation(c,{range:'assistant'}).assets,undefined);
});
test('redaction drops image and PDF pixels, cleans DOCX text, and never corrupts base64',()=>{
  const c=demoConversation();
  c.messages[0].blocks.push(...['a','b','c'].map(assetId=>({type:'asset',assetId,name:'secret document'})));
  c.assets=[{id:'a',status:'ready',kind:'image',data:image},{id:'b',status:'ready',kind:'pdf',pages:[{type:'image',data:image}]},{id:'c',status:'ready',kind:'docx',blocks:[{type:'paragraph',text:'secret'},{type:'image',data:image}]}];
  const result=prepareConversation(c,{redact:'secret'});
  assert(!JSON.stringify(result).includes(image));assert(!JSON.stringify(result).includes('secret'));
  assert.equal(result.assets[0].status,'unavailable');assert.equal(result.assets[1].status,'unavailable');
  assert.equal(result.assets[2].blocks[0].text,'[redacted]');assert(JSON.stringify(c).includes('secret'));
});
test('language runs preserve the original text and select locally bundled fonts',()=>{
  const value='Hello नमस्ते നമസ്കാരം';
  const runs=fontRuns(value);assert.equal(runs.map(x=>x.text).join(''),value);
  assert(runs.some(x=>x.font==='Devanagari'));assert(runs.some(x=>x.font==='Malayalam'));
});
test('capture warnings survive metadata removal',()=>{
  const c=demoConversation();c.capture={warnings:['Unavailable file']};
  const out=prepareConversation(c,{metadata:false});
  assert.equal(out.title,undefined);assert(htmlDocument(out).includes('Unavailable file'));
});

test('PDF has paired turn numbers, source logo, honest metadata and message boxes',()=>{
  const c=prepareConversation({...demoConversation(),model:'test-model',effort:'high'});
  const def=pdfDefinition(c), all=nodes(def.content);
  const labels=all.filter(n=>n.style==='speaker').map(n=>n.text?.map(t=>t.text).join(''));
  assert.deepEqual(labels,['USER  1','1','USER  2','2']);
  assert(all.some(n=>n.svg?.includes('<path')));
  assert(all.some(n=>n.text?.some?.(t=>t.text?.includes('test-model'))));
  assert(all.some(n=>n.table?.headerRows===1 && n.layout?.fillColor));
  const selected=prepareConversation(c,{range:'selected',selected:[2,3]});
  assert.deepEqual(selected.messages.map(m=>m.turn),[2,2]);
});

test('attachments have borders and remain in flow between messages',()=>{
  const c={platform:'chatgpt',messages:[{role:'user',blocks:[{type:'paragraph',text:'before'},{type:'asset',assetId:'a',name:'Image'},{type:'paragraph',text:'after'}]}],assets:[{id:'a',status:'ready',kind:'image',data:image}]};
  const def=pdfDefinition(c);
  const boxes=def.content.filter(n=>n.table);
  assert.equal(boxes.length,3);
  assert(!nodes(def.content).some(n=>n.pageBreak==='before'));
  assert.equal(boxes[1].unbreakable,true);
  assert.equal(boxes[1].layout.vLineWidth(),.7);
  assert(nodes(boxes[1]).some(n=>n.style==='speaker' && n.text.map(t=>t.text).join('')==='USER 1  /  ATTACHMENT'));
  assert.deepEqual(nodes(boxes[1]).find(n=>n.image).fit,[437,250]);
});
test('document attachment pages keep readable size without forced breaks',()=>{
  const c={messages:[{role:'assistant',blocks:[{type:'asset',assetId:'pdf'}]}],assets:[{id:'pdf',kind:'pdf',status:'ready',name:'Document',pages:[{data:image,name:'Page 1'},{data:image,name:'Page 2'}]}]};
  const def=pdfDefinition(c);
  assert.equal(nodes(def.content).filter(n=>n.image).length,2);
  assert(nodes(def.content).filter(n=>n.image).every(n=>n.fit[1]===600));
  assert(!nodes(def.content).some(n=>n.pageBreak));
});
test('small presentation images do not upscale into large PDF blocks',()=>{
  const c={messages:[{role:'assistant',blocks:[{type:'asset',assetId:'deck'}]}],assets:[{id:'deck',kind:'pptx',status:'ready',name:'Slides',blocks:[{type:'image',data:image,width:40,height:20,preventUpscale:true}]}]};
  assert.deepEqual(nodes(pdfDefinition(c).content).find(n=>n.image).fit,[30,15]);
});
