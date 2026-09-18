import {test} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {verifyOfficeFile} from '../src/office-file.js';
async function fixture(kind='pptx') {
  const zip=new JSZip();zip.file('[Content_Types].xml','<Types/>');
  zip.file(kind==='pptx'?'ppt/presentation.xml':'word/document.xml','<document/>');
  return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
}
test('Office verification distinguishes PPTX and DOCX containers',async()=>{
  for(const kind of ['pptx','docx']){const data=await fixture(kind);assert.equal(verifyOfficeFile(data,kind).kind,kind);assert.throws(()=>verifyOfficeFile(data,kind==='pptx'?'docx':'pptx'),/not a/);}
});
test('Office verification rejects HTML, truncation and missing package parts',async()=>{
  assert.throws(()=>verifyOfficeFile(new TextEncoder().encode('<html>Login required instead of file</html>').buffer,'pptx'));
  const file=await fixture();assert.throws(()=>verifyOfficeFile(file.slice(0,-1),'pptx'));
  const zip=new JSZip();zip.file('not-a-presentation.txt','text');
  const awaited=await zip.generateAsync({type:'arraybuffer'});assert.throws(()=>verifyOfficeFile(awaited,'pptx'),/not a/);
});
test('Office verification rejects unsafe paths and oversized expansion',async()=>{
  const zip=new JSZip();zip.file('[Content_Types].xml','<Types/>');zip.file('ppt/presentation.xml','<document/>');zip.file('../evil','x');
  const awaited=await zip.generateAsync({type:'arraybuffer'});assert.throws(()=>verifyOfficeFile(awaited,'pptx'),/Unsafe/);
  const bytes=await fixture(),v=new DataView(bytes);let at=0;
  while(v.getUint32(at,true)!==0x02014b50)at++;
  v.setUint32(at+24,129*1024*1024,true);assert.throws(()=>verifyOfficeFile(bytes,'pptx'),/128 MB/);
});
test('Office verification rejects encryption and central/local mismatches',async()=>{
  for(const mode of ['encrypted','method']){const bytes=await fixture(),v=new DataView(bytes);let at=0;while(v.getUint32(at,true)!==0x02014b50)at++;
    if(mode==='encrypted')v.setUint16(at+8,1,true);else v.setUint16(v.getUint32(at+42,true)+8,99,true);
    assert.throws(()=>verifyOfficeFile(bytes,'pptx'));
  }
});
