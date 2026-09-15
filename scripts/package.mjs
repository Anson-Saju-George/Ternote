import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist'),release=join(root,'release');
const manifest=JSON.parse(await readFile(join(dist,'manifest.json'),'utf8'));
async function entries(dir,prefix=''){const result=[];for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const name=prefix+e.name;if(e.isDirectory())result.push(...await entries(join(dir,e.name),name+'/'));else result.push({name,data:await readFile(join(dir,e.name))});}return result;}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;
for(const {name,data}of await entries(dist)){
  const n=Buffer.from(name),crc=crc32(data),header=Buffer.alloc(30),compressed=deflateRawSync(data,{level:9});
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(n.length,26);
  header.writeUInt16LE(8,8);header.writeUInt32LE(compressed.length,18);
  local.push(header,n,compressed);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  c.writeUInt16LE(8,10);c.writeUInt32LE(compressed.length,20);
  central.push(c,n);offset+=header.length+n.length+compressed.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length/2,8);end.writeUInt16LE(central.length/2,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...local,directory,end]),name='personal-ai-chat-exporter-'+manifest.version+'.zip';
await mkdir(release,{recursive:true});await writeFile(join(release,name),zip);
await writeFile(join(release,name+'.sha256'),createHash('sha256').update(zip).digest('hex')+'  '+name+'\n');
console.log('Development ZIP: '+join(release,name)+' ('+zip.length+' bytes)');
