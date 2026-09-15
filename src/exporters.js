import { numberedMessages } from './document-identity.js';
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function filename(value,extension){
  let name=Array.from(String(value||'conversation').normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g,'-')).slice(0,100).join('').replace(/[. ]+$/g,'').trim()||'conversation';
  if(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name))name='_'+name;
  return name+'.'+extension;
}
export function csvCell(value){
  let s=String(value??'');
  if(/^[\s\u0000-\u001f]*[=+\-@]/u.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
export function prepareConversation(c,{range='all',selected=[],metadata=true,redact=''}={}){
  const messages=numberedMessages(c.messages).filter((m,i)=>range==='selected'?selected.includes(i):['user','assistant'].includes(range)?m.role===range:true)
    .map(m=>metadata?m:Object.fromEntries(Object.entries(m).filter(([key])=>!['model','effort','timestamp'].includes(key))));
  if(!messages.length)throw new Error('Choose at least one message.');
  const terms=redact.split('\n').map(s=>s.trim()).filter(Boolean);
  function clean(value,key=''){
    if(typeof value==='string')return ['data','assetId','id','type','kind','mime','status','role','language'].includes(key)?value:terms.reduce((s,t)=>s.split(t).join('[redacted]'),value);
    if(Array.isArray(value))return value.map(item=>clean(item,key));
    if(value&&typeof value==='object'){
      if(terms.length&&value.type==='image')return {type:'attachment-note',text:'Image omitted while exact-text redaction is enabled.'};
      return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v,k)]));
    }
    return value;
  }
  const ids=new Set(messages.flatMap(m=>m.blocks.filter(b=>b.type==='asset').map(b=>b.assetId)));
  const assets=(c.assets||[]).filter(a=>ids.has(a.id)).map(a=>{
    if(terms.length&&(a.kind==='image'||a.kind==='pdf'))return {id:a.id,name:a.name,kind:a.kind,status:'unavailable',error:'Omitted while exact-text redaction is enabled. Image pixels and attached PDF pages cannot be text-redacted safely.'};
    return a;
  });
  return clean({schemaVersion:c.schemaVersion||1,...(metadata?{title:c.title,platform:c.platform,sourceUrl:c.sourceUrl,exportedAt:c.exportedAt,completeness:c.completeness,model:c.model,effort:c.effort,modelSource:c.modelSource}:{}),
    ...(c.capture?{capture:c.capture}:{}),...(assets.length?{assets}:{}),messages});
}
export function blockText(b){
  if(b.type==='asset')return '[Attachment: '+(b.name||'Attachment')+']';
  if(b.type==='image')return '[Image: '+(b.name||'Image')+']';
  if(b.type==='table')return b.rows.map(row=>row.join('\t')).join('\n');
  if(b.type==='list')return b.items.map((item,i)=>(b.ordered?(i+1)+'. ':'- ')+item).join('\n');
  return b.text||'';
}
export function messageText(m){return m.blocks.map(blockText).join('\n\n');}
const markdownText = value => String(value ?? '').replace(/[\\\x60*_[\]<>#]/g,'\\$&');
function blockMarkdown(b){
  const text=blockText(b);
  if(b.type==='code'){const tick=String.fromCharCode(96);const fence=tick.repeat(Math.max(3,...(text.match(/\x60+/g)||[]).map(s=>s.length+1)));return fence+(b.language||'')+'\n'+text+'\n'+fence;}
  if(b.type==='heading')return '#'.repeat(Math.max(1,Math.min(6,b.level)))+' '+markdownText(text);
  if(b.type==='quote')return markdownText(text).replace(/^/gm,'> ');
  if(b.type==='list')return b.items.map((item,i)=>(b.ordered?(i+1)+'. ':'- ')+markdownText(item)).join('\n');
  if(b.type==='table'){
    const width=Math.max(0,...b.rows.map(r=>r.length));if(!width)return '';
    const line=row=>'| '+Array.from({length:width},(_,i)=>markdownText(row[i]||'').replace(/\|/g,'\\|').replace(/\n/g,'<br>')).join(' | ')+' |';
    return [line(b.rows[0]),'| '+Array(width).fill('---').join(' | ')+' |',...b.rows.slice(1).map(line)].join('\n');
  }
  return markdownText(text);
}
const safeRaster=value=>typeof value==='string'&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value);
function blockHtml(b,assets=[]){
  if(b.type==='asset'){
    const a=assets.find(item=>item.id===b.assetId);
    if(!a||a.status!=='ready')return '<p class="attachment-note">'+escapeHtml(b.name||'Attachment')+' — '+escapeHtml(a?.error||'Unavailable')+'</p>';
    if(a.kind==='image')return blockHtml({type:'image',...a},assets);
    return '<div class="attachment"><h3>'+escapeHtml(a.name)+'</h3>'+(a.pages||a.blocks||[]).map(child=>blockHtml(child,assets)).join('')+(a.warnings||[]).map(w=>'<p class="attachment-note">'+escapeHtml(w)+'</p>').join('')+'</div>';
  }
  if(b.type==='image')return safeRaster(b.data)?'<figure><img loading="lazy" decoding="async" src="'+b.data+'" width="'+Math.max(1,Number(b.width)||1)+'" height="'+Math.max(1,Number(b.height)||1)+'" alt="'+escapeHtml(b.name||'Image')+'"><figcaption>'+escapeHtml(b.name||'')+'</figcaption></figure>':'<p class="attachment-note">Image unavailable.</p>';
  if(b.type==='code')return '<pre><code>'+escapeHtml(b.text)+'</code></pre>';
  if(b.type==='table')return '<table>'+b.rows.map((row,i)=>'<tr>'+row.map(cell=>'<'+(i?'td':'th')+'>'+escapeHtml(cell)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</table>';
  if(b.type==='list'){const tag=b.ordered?'ol':'ul';return '<'+tag+'>'+b.items.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</'+tag+'>';}
  const tag=b.type==='heading'?'h'+Math.max(1,Math.min(6,b.level)):b.type==='quote'?'blockquote':'p';
  return '<'+tag+(b.type==='attachment-note'?' class="attachment-note"':'')+'>'+escapeHtml(b.text).replace(/\n/g,'<br>')+'</'+tag+'>';
}
export function htmlDocument(c,theme='light'){
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+escapeHtml(c.title||'Conversation')+'</title><style>'+
  'body{font:16px/1.65 system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 28px;overflow-wrap:anywhere;background:'+(theme==='dark'?'#17221f;color:#e5ede8':'#fff;color:#243b32')+'}h1{font-size:30px;line-height:1.2}section{border-top:1px solid #8da99766;margin-top:26px;padding-top:14px}.role,.meta{font-size:12px;opacity:.7}.role{text-transform:uppercase;letter-spacing:.1em;font-weight:700}pre{white-space:pre-wrap;background:#8da99722;padding:16px;border-radius:8px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #8da99788;padding:8px;text-align:left}blockquote{border-left:3px solid #7d9d8a;padding-left:16px;margin-left:0}@page{margin:18mm}@media print{body{margin:0;padding:0;background:white;color:#111}pre,table{break-inside:avoid}h1,h2,h3,.role{break-after:avoid}}'+
  '</style></head><body><h1>'+escapeHtml(c.title||'Conversation')+'</h1>'+(c.sourceUrl?'<p class="meta">'+escapeHtml(c.platform)+' · '+escapeHtml(c.exportedAt)+'<br>'+escapeHtml(c.sourceUrl)+'</p>':'')+
  '<style>figure{margin:16px 0;break-inside:avoid}figure img{max-width:100%;height:auto;display:block;margin:auto}figcaption{font-size:12px;color:#6b7e74;margin-top:6px;text-align:center}.attachment{margin:22px 0;padding:16px;border:1px solid #8da99766;border-radius:8px}.attachment-note{font-size:12px;color:#8b5626}section{content-visibility:auto;contain-intrinsic-size:auto 400px}@media print{section{content-visibility:visible}figure img{max-height:240mm;object-fit:contain}}</style>'+
  (c.capture?.warnings||[]).map(w=>'<p class="attachment-note">'+escapeHtml(w)+'</p>').join('')+
  c.messages.map(m=>'<section><p class="role">'+escapeHtml(m.role)+'</p>'+m.blocks.map(b=>blockHtml(b,c.assets)).join('')+'</section>').join('')+'</body></html>';
}
export function exportConversation(c,format,theme='light'){
  if(format==='pdf')throw new Error('Use the asynchronous PDF generator for a real PDF download.');
  if(format==='html')return {extension:'html',mime:'text/html;charset=utf-8',text:htmlDocument(c,theme)};
  if(format==='json')return {extension:'json',mime:'application/json;charset=utf-8',text:JSON.stringify(c,null,2)};
  if(format==='csv'){
    const rows=[['role','content',...(c.title!==undefined?['title','platform','source_url']:[])]];
    c.messages.forEach(m=>rows.push([m.role,messageText(m),...(c.title!==undefined?[c.title,c.platform,c.sourceUrl]:[])]));
    return {extension:'csv',mime:'text/csv;charset=utf-8',text:'\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')};
  }
  const md=format==='markdown';
  return {extension:md?'md':'txt',mime:'text/plain;charset=utf-8',text:(c.title?(md?'# ':'')+(md?markdownText(c.title):c.title)+'\n\n':'')+(c.sourceUrl?'Source: '+(md?markdownText(c.sourceUrl):c.sourceUrl)+'\n\n':'')+
    c.messages.map(m=>(md?'## ':'')+m.role+'\n\n'+(md?m.blocks.map(blockMarkdown).join('\n\n'):messageText(m))).join('\n\n')};
}
