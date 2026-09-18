import { workerJob } from './worker-job.js';

const descendants = (root, name) => [...root.getElementsByTagNameNS('*',name)];
const child = (root, name) => [...root.children].find(node=>node.localName===name);
const relationshipId = (node, name) => [...node.attributes].find(a=>a.localName===name && /relationships$/.test(a.namespaceURI||''))?.value;

// Reflow supported slide content into inert blocks, never HTML or Office scripts.
export async function presentationBlocks(buffer, {signal,onProgress=()=>{},rasterize}) {
  const parts = new Map((await workerJob('./pptx-worker.js',{buffer},{signal,timeout:60000})).map(p=>[p.name,p.buffer]));
  const warnings = new Set(['PPTX content is reflowed, not a visual slide replica. Layouts, master-slide content, notes, shapes, charts, SmartArt, audio, video and animations are not reproduced. Save the original for the complete presentation.']);
  let renderedSize=0;
  function xml(name, optional=false) {
    const data=parts.get(name);
    if (!data) { if(optional)return; throw new Error('Missing presentation part: '+name); }
    const text=new TextDecoder('utf-8',{fatal:true}).decode(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Presentation XML declarations are not supported.');
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if (descendants(doc,'parsererror').length) throw new Error('Invalid presentation XML.');
    return doc;
  }
  function relationships(name) {
    const at=name.lastIndexOf('/'), doc=xml(name.slice(0,at+1)+'_rels/'+name.slice(at+1)+'.rels',true), map=new Map();
    if (!doc)return map;
    for(const rel of descendants(doc,'Relationship')) {
      const id=rel.getAttribute('Id'),target=rel.getAttribute('Target')||'';
      if (!id || map.has(id)) throw new Error('Ambiguous presentation relationship.');
      if (rel.getAttribute('TargetMode')==='External' || /[:\\?#]/.test(target)) { map.set(id,{external:true}); continue; }
      const url=new URL(target,'https://package.invalid/'+name);
      const path=decodeURIComponent(url.pathname.slice(1));
      if (url.origin!=='https://package.invalid' || !path.startsWith('ppt/') || path.includes('..')) throw new Error('Unsafe presentation relationship.');
      map.set(id,{path,type:rel.getAttribute('Type')||''});
    }
    return map;
  }
  function paragraphs(root) {
    return descendants(root,'p').map(p=>[...p.getElementsByTagNameNS('*','*')].map(n=>n.localName==='t'?n.textContent:n.localName==='br'?'\n':n.localName==='tab'?'\t':'').join('')).filter(Boolean);
  }
  const presentation=xml('ppt/presentation.xml'), relations=relationships('ppt/presentation.xml');
  const slideList=descendants(presentation,'sldIdLst')[0];
  const slides=slideList ? [...slideList.children].filter(n=>n.localName==='sldId') : [];
  if (!slides.length) throw new Error('The presentation has no readable slide list.');
  const blocks=[];
  for(let index=0;index<slides.length;index++) {
    signal?.throwIfAborted();
    onProgress({stage:'Reading presentation slides',current:index+1,total:slides.length});
    const rel=relations.get(relationshipId(slides[index],'id'));
    if (!rel?.path || !rel.type.endsWith('/slide')) throw new Error('A slide relationship is missing or unsupported.');
    const doc=xml(rel.path), slideRelations=relationships(rel.path), tree=descendants(doc,'spTree')[0];
    if (!tree) throw new Error('A presentation slide has no readable shape tree.');
    blocks.push({type:'heading',level:2,text:'Slide '+(index+1)});
    const before=blocks.length;
    async function walk(root,depth=0) {
      if(depth>40)throw new Error('Presentation groups are nested too deeply.');
      for(const node of root.children) {
        signal?.throwIfAborted();
        if(node.localName==='grpSp') { await walk(node,depth+1); continue; }
        if(node.localName==='sp') {
          const body=child(node,'txBody');
          if(body) for(const text of paragraphs(body))blocks.push({type:'paragraph',text});
        } else if(node.localName==='pic') {
          const blip=descendants(node,'blip')[0], imageRel=blip && slideRelations.get(relationshipId(blip,'embed'));
          const path=imageRel?.path, data=path && parts.get(path), extension=path?.split('.').at(-1).toLowerCase();
          if(data && imageRel.type.endsWith('/image') && /^(png|jpe?g|gif|webp)$/.test(extension)) {
            try {
              const image=await rasterize(new Blob([data],{type:'image/'+(extension==='jpg'?'jpeg':extension)}),signal);
              renderedSize+=image.data.length;
              if(renderedSize>128*1024*1024)throw new Error('Presentation images exceed the 128 MB rendering budget.');
              blocks.push({type:'image',name:'Slide '+(index+1)+' image',...image,preventUpscale:true});
            } catch(error) { signal?.throwIfAborted(); if(renderedSize>128*1024*1024)throw error; blocks.push({type:'attachment-note',text:'Slide image could not be decoded.'}); }
          } else blocks.push({type:'attachment-note',text:'Linked or unsupported slide image was not included.'});
        } else if(node.localName==='graphicFrame') {
          const table=descendants(node,'tbl')[0];
          if(table) blocks.push({type:'table',rows:[...table.children].filter(n=>n.localName==='tr').map(row=>[...row.children].filter(n=>n.localName==='tc').map(cell=>paragraphs(cell).join('\n')))});
          else blocks.push({type:'attachment-note',text:'A chart, diagram or embedded object is not reproduced. See the original presentation.'});
        } else if(!['nvGrpSpPr','grpSpPr'].includes(node.localName)) {
          blocks.push({type:'attachment-note',text:'An unsupported slide element ('+node.localName+') is not reproduced.'});
        }
      }
    }
    await walk(tree);
    if(blocks.length===before) blocks.push({type:'attachment-note',text:'No supported text, tables or embedded images were found on this slide.'});
    // Yield between slides so cancellation and the interface remain responsive.
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {blocks,warnings:[...warnings],slideCount:slides.length};
}
