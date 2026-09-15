import {mkdir,cp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {deflateSync} from 'node:zlib';
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
// dist is this script's fixed generated output directory, never a user-supplied path.
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
// Unreleased experiments live in docs/drafts, outside the shipped src tree.
await cp(join(root,'src'),join(dist,'src'),{recursive:true});
await cp(join(root,'manifest.json'),join(dist,'manifest.json'));
await mkdir(join(dist,'assets'),{recursive:true});
const vendor=join(dist,'vendor');
await mkdir(join(vendor,'pdfjs'),{recursive:true});
await mkdir(join(vendor,'pdfmake'),{recursive:true});
await mkdir(join(vendor,'mammoth'),{recursive:true});
for(const file of ['pdf.mjs','pdf.worker.mjs'])await cp(join(root,'node_modules/pdfjs-dist/build',file),join(vendor,'pdfjs',file));
for(const dir of ['cmaps','standard_fonts','wasm','iccs'])await cp(join(root,'node_modules/pdfjs-dist',dir),join(vendor,'pdfjs',dir),{recursive:true});
await cp(join(root,'node_modules/pdfmake/build/vfs_fonts.js'),join(vendor,'pdfmake/vfs_fonts.js'));
// Isolate the UMD export: WorkerGlobalScope.fonts is read-only in Chromium.
let pdfmake=await readFile(join(root,'node_modules/pdfmake/build/pdfmake.min.js'),'utf8');
// Pinned fontkit 2.0.4 in pdfmake 0.3.11: NULL GPOS anchors mean no match, not a crash.
// See https://github.com/foliojs/fontkit/issues/367. Skip those lookups without moving the glyph.
const anchorCall=/return this\.applyAnchor\(([a-z]),([a-z]),([a-z])\),!0/g;
if([...pdfmake.matchAll(anchorCall)].length!==3)throw new Error('Review the fontkit compatibility patch after changing pdfmake.');
pdfmake=pdfmake.replace(anchorCall,(_,mark,anchor,index)=>'return !!('+mark+'&&'+mark+'.markAnchor&&'+anchor+')&&(this.applyAnchor('+mark+','+anchor+','+index+'),!0)');
await writeFile(join(vendor,'pdfmake/pdfmake.min.js'),'const module={exports:{}},exports=module.exports;\n'+pdfmake+'\nglobalThis.pdfMake=module.exports;\n');
await cp(join(root,'node_modules/pdfmake/build/standard-fonts/Courier.js'),join(vendor,'pdfmake/Courier.js'));
await cp(join(root,'node_modules/mammoth/mammoth.browser.min.js'),join(vendor,'mammoth/mammoth.browser.min.js'));
const fonts={};
for(const file of await readdir(join(root,'assets/fonts')))if(file.endsWith('.ttf'))fonts[file]=(await readFile(join(root,'assets/fonts',file))).toString('base64');
await writeFile(join(vendor,'pdfmake/extra-fonts.js'),'globalThis.pdfMake.addVirtualFileSystem('+JSON.stringify(fonts)+');\n');
// Preserve licenses for bundled direct and transitive packages. No network access during builds.
let notices='THIRD-PARTY NOTICES\n\nOriginal product source is UNLICENSED pending the owner’s license choice.\n\nModified pdfmake 0.3.11 browser bundle: isolated UMD exports for module workers; guard three NULL GPOS-anchor lookups in bundled fontkit 2.0.4 (upstream issue #367). Original licenses follow.\n\n';
async function licenses(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
    const path=join(dir,entry.name);
    if(entry.name.startsWith('@')){await licenses(path);continue;}
    try{
      const pkg=JSON.parse(await readFile(join(path,'package.json'),'utf8'));
      notices+='\n\n'+pkg.name+' '+pkg.version+' — '+JSON.stringify(pkg.license||'See package')+'\n';
      for(const name of await readdir(path))if(/^(license|licence|copying|notice)(\..*)?$/i.test(name))try{notices+='\n'+await readFile(join(path,name),'utf8');}catch{}
      try{await licenses(join(path,'node_modules'));}catch{}
    }catch{}
  }
}
await licenses(join(root,'node_modules'));
notices+='\n\nNoto fonts\n'+await readFile(join(root,'assets/fonts/OFL.txt'),'utf8');
notices+='\n\nRoboto fonts\n'+await readFile(join(root,'assets/fonts/Roboto-OFL.txt'),'utf8');
notices+='\n\nNoto Emoji\n'+await readFile(join(root,'assets/fonts/Emoji-OFL.txt'),'utf8');
await writeFile(join(dist,'THIRD-PARTY-NOTICES.txt'),notices);
// Original geometric arrow icon, generated from code. No reference assets.
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([size,t,data,crc]);}
for(const size of [16,32,48,128]){
  const pixels=Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x+.5)/size,py=(y+.5)/size,round=(Math.max(0,Math.abs(px-.5)-.29)**2+Math.max(0,Math.abs(py-.5)-.29)**2)<.2**2;
    const arrow=(px>.31&&px<.71&&Math.abs(px+py-1)<.075)||(py>.27&&py<.36&&px>.43&&px<.74)||(px>.64&&px<.74&&py>.27&&py<.57);
    const at=y*(size*4+1)+1+x*4;pixels.set(arrow?[224,242,188,255]:[36,79,64,round?255:0],at);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
  await writeFile(join(dist,'assets','icon'+size+'.png'),png);
}
async function sizeOf(dir){let bytes=0;for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);bytes+=entry.isDirectory()?await sizeOf(p):(await readFile(p)).length;}return bytes;}
console.log('Unpacked extension ready: '+dist+'\nTotal package bytes: '+await sizeOf(dist));
