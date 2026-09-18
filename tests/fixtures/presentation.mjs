import JSZip from 'jszip';
import {deflateSync} from 'node:zlib';
function pixelPng() {
  function chunk(type,data) {
    const body=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff;
    for(const byte of body){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    const size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);
    return Buffer.concat([size,body,checksum]);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(2);header.writeUInt32BE(2,4);header[8]=8;header[9]=6;
  const pixels=Buffer.from([0,36,79,64,255,36,79,64,255,0,36,79,64,255,36,79,64,255]);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
const p='http://schemas.openxmlformats.org/presentationml/2006/main',a='http://schemas.openxmlformats.org/drawingml/2006/main',r='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const rels=body=>`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
const shape=text=>`<p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
export async function presentationFixture({compression='DEFLATE',unsafe=false}={}) {
  const zip=new JSZip();zip.file('[Content_Types].xml','<Types/>');
  zip.file('ppt/presentation.xml',`<p:presentation xmlns:p="${p}" xmlns:r="${r}"><p:sldIdLst><p:sldId id="256" r:id="first"/><p:sldId id="257" r:id="second"/></p:sldIdLst></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels',rels(`<Relationship Id="first" Type="${r}/slide" Target="slides/slide2.xml"/><Relationship Id="second" Type="${r}/slide" Target="slides/slide1.xml"/>`));
  zip.file('ppt/slides/slide2.xml',`${unsafe?'<!DOCTYPE x [<!ENTITY bad "unsafe">]>':''}<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree>${shape('FIRST SLIDE marker')}<p:pic><p:blipFill><a:blip r:embed="image"/></p:blipFill></p:pic><p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Table heading</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame><p:graphicFrame><a:graphic/></p:graphicFrame></p:spTree></p:cSld></p:sld>`);
  zip.file('ppt/slides/_rels/slide2.xml.rels',rels(`<Relationship Id="image" Type="${r}/image" Target="../media/pixel.png"/>`));
  zip.file('ppt/slides/slide1.xml',`<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree><p:grpSp>${shape('SECOND SLIDE marker')}</p:grpSp><p:pic><p:blipFill><a:blip r:link="external"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>`);
  zip.file('ppt/slides/_rels/slide1.xml.rels',rels(`<Relationship Id="external" Type="${r}/image" Target="https://example.invalid/tracker.png" TargetMode="External"/>`));
  zip.file('ppt/media/pixel.png',pixelPng());
  return zip.generateAsync({type:'arraybuffer',compression});
}
