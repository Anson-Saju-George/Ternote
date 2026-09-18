// Structural verification only, not a slide renderer or a claim that an Office file is safe to open.
export function verifyOfficeFile(buffer, kind, includeEntries = false) {
  if (!['docx','pptx'].includes(kind)) throw new Error('Unsupported Office format.');
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 22 || buffer.byteLength > 64*1024*1024) throw new Error('Invalid or oversized Office file.');
  const view=new DataView(buffer), bytes=new Uint8Array(buffer); let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
    if(view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
  }
  if(end<0 || view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0) throw new Error('Not a supported Office ZIP container.');
  const count=view.getUint16(end+10,true), start=view.getUint32(end+16,true), size=view.getUint32(end+12,true);
  if(!count || count>10000 || view.getUint16(end+8,true)!==count || start+size!==end) throw new Error('Invalid Office ZIP directory.');
  let at=start,expanded=0;const names=new Set(),entries=[],decoder=new TextDecoder('utf-8',{fatal:true});
  for(let i=0;i<count;i++) {
    if(at+46>end || view.getUint32(at,true)!==0x02014b50) throw new Error('Invalid Office ZIP entry.');
    const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),length=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true);
    const compressed=view.getUint32(at+20,true),uncompressed=view.getUint32(at+24,true),local=view.getUint32(at+42,true);
    if((flags&1) || ![0,8].includes(method) || at+46+length+extra+comment>end || local+30>start || view.getUint16(at+34,true)!==0) throw new Error('Encrypted or unsupported Office ZIP entry.');
    expanded+=uncompressed;if(expanded>128*1024*1024)throw new Error('Office file expands beyond the 128 MB safety budget.');
    const name=decoder.decode(bytes.subarray(at+46,at+46+length));
    if(!name || name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.split('/').includes('..') || names.has(name))throw new Error('Unsafe or duplicate Office ZIP path.');
    if(view.getUint32(local,true)!==0x04034b50)throw new Error('Invalid Office ZIP local entry.');
    const localName=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true);
    if(local+30+localName+localExtra+compressed>start || view.getUint16(local+6,true)!==flags || view.getUint16(local+8,true)!==method || decoder.decode(bytes.subarray(local+30,local+30+localName))!==name)throw new Error('Office ZIP entry metadata does not match.');
    entries.push({name,method,compressed,uncompressed,crc:view.getUint32(at+16,true),offset:local+30+localName+localExtra});
    names.add(name);at+=46+length+extra+comment;
  }
  if(at!==end || !names.has('[Content_Types].xml') || !names.has(kind==='pptx'?'ppt/presentation.xml':'word/document.xml'))throw new Error('The downloaded file is not a '+kind.toUpperCase()+' container.');
  return {kind,entries:count,expandedBytes:expanded,...(includeEntries?{files:entries}:{})};
}
