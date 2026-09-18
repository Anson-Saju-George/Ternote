import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presentationFixture} from './fixtures/presentation.mjs';
import {unpackPresentation} from '../src/pptx-unzip.js';
import {verifyOfficeFile} from '../src/office-file.js';

test('presentation unpacking supports stored and compressed parts without a ZIP dependency',async()=>{
  for(const compression of ['STORE','DEFLATE']) {
    const parts=await unpackPresentation(await presentationFixture({compression}));
    assert(parts.some(p=>p.name==='ppt/slides/slide2.xml'));
    assert(new TextDecoder().decode(parts.find(p=>p.name==='ppt/slides/slide2.xml').buffer).includes('FIRST SLIDE marker'));
    assert(parts.find(p=>p.name==='ppt/media/pixel.png').buffer.byteLength>0);
  }
});
test('presentation unpacking rejects corrupt bytes and false expansion declarations',async()=>{
  const data=await presentationFixture({compression:'STORE'}),entry=verifyOfficeFile(data,'pptx',true).files.find(e=>e.name==='ppt/presentation.xml');
  new Uint8Array(data)[entry.offset]^=1;
  await assert.rejects(unpackPresentation(data),/checksum/);
  const compressed=await presentationFixture(),view=new DataView(compressed);
  for(let at=0;at<compressed.byteLength-46;at++)if(view.getUint32(at,true)===0x02014b50 && view.getUint32(at+24,true)>100){view.setUint32(at+24,1,true);break;}
  await assert.rejects(unpackPresentation(compressed),/declared size/);
});
test('presentation unpacking respects cancellation',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(unpackPresentation(await presentationFixture(),controller.signal),{name:'AbortError'});
});
