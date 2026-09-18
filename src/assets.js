import { workerJob } from './worker-job.js';
import { presentationBlocks } from './pptx.js';
export const safeRaster = value => typeof value === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value);
export async function rasterize(blob, signal) {
  signal?.throwIfAborted();
  const bitmap = await createImageBitmap(blob);
  try {
    signal?.throwIfAborted();
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 80_000_000) throw new Error('Image dimensions exceed the safe rendering budget.');
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    try {
      const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return { data: canvas.toDataURL('image/jpeg', .92), width: canvas.width, height: canvas.height };
    } finally { canvas.width = canvas.height = 0; }
  } finally { bitmap.close(); }
}
// The parser's HTML is never inserted into a live document. Rebuild a tiny inert data model.
export async function documentBlocks(html, signal) {
  const template = document.createElement('template'); template.innerHTML = html;
  const result = [];
  async function walk(root, depth = 0) {
    if (depth > 80) throw new Error('Document nesting is too deep to render safely.');
    let text = '';
    const flush = () => { if (text.trim()) result.push({ type: 'paragraph', text: text.trim() }); text = ''; };
    for (const n of root.childNodes) {
      signal?.throwIfAborted();
      if (n.nodeType === Node.TEXT_NODE) { text += n.textContent; continue; }
      if (n.nodeType !== Node.ELEMENT_NODE || /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|FORM|INPUT|BUTTON)$/.test(n.tagName)) continue;
      if (n.tagName === 'IMG') {
        flush();
        const src = n.getAttribute('src') || '';
        if (/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(src)) {
          const body = src.slice(src.indexOf(',') + 1), bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
          result.push({ type: 'image', name: n.alt || 'Document image', ...await rasterize(new Blob([bytes], { type: src.slice(5,src.indexOf(';')) }), signal) });
        } else result.push({ type: 'attachment-note', text: n.alt || 'An image in this document is unavailable.' });
      } else if (n.tagName === 'TABLE') {
        flush(); result.push({ type: 'table', rows: [...n.rows].map(row => [...row.cells].map(cell => cell.textContent)) });
        for (const image of n.querySelectorAll('img')) { const span = document.createElement('span'); span.append(image.cloneNode(true)); await walk(span, depth + 1); }
      } else if (/^H[1-6]$/.test(n.tagName)) { flush(); result.push({ type: 'heading', level: Number(n.tagName[1]), text: n.textContent }); }
      else if (n.tagName === 'PRE') { flush(); result.push({ type: 'code', text: n.textContent }); }
      else if (n.tagName === 'UL' || n.tagName === 'OL') { flush(); result.push({ type: 'list', ordered: n.tagName === 'OL', items: [...n.children].map(child => child.textContent) }); }
      else if (n.tagName === 'BR') text += '\n';
      else if (/^(P|DIV|SECTION|ARTICLE|BLOCKQUOTE)$/.test(n.tagName)) { flush(); await walk(n, depth + 1); }
      else { text += n.textContent; }
    }
    flush();
  }
  await walk(template.content);
  return result;
}
let pdfLibrary;
export async function getPdfLibrary() {
  if (!pdfLibrary) pdfLibrary = import('../vendor/pdfjs/pdf.mjs').then(lib => { lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.mjs', import.meta.url).href; return lib; });
  return pdfLibrary;
}
export async function openPdf(buffer) {
  const lib = await getPdfLibrary();
  const base = new URL('../vendor/pdfjs/', import.meta.url).href;
  return lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false,
    cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/',
    wasmUrl: base + 'wasm/', iccUrl: base + 'iccs/', useWorkerFetch: true, stopAtErrors: true });
}
export async function renderAsset(meta, buffer, { signal, onProgress = () => {} } = {}) {
  signal?.throwIfAborted();
  const bytes = new Uint8Array(buffer), signature = new TextDecoder().decode(bytes.subarray(0,8));
  if (/^%PDF-/.test(signature)) {
    const task = await openPdf(buffer), abort = () => { void task.destroy(); };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      task.onPassword = () => { void task.destroy(); };
      const pdf = await task.promise, pages = []; let rendered = 0;
      for (let number = 1; number <= pdf.numPages; number++) {
        signal?.throwIfAborted(); onProgress({ stage: 'Rendering ' + meta.name, current: number, total: pdf.numPages });
        const page = await pdf.getPage(number), original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(1.6, 2200 / Math.max(original.width, original.height)) });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        try {
          await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff', intent: 'print' }).promise;
          signal?.throwIfAborted();
          const data = canvas.toDataURL('image/jpeg', .92); rendered += data.length;
          if (rendered > 128 * 1024 * 1024) throw new Error('Rendered PDF exceeds the safe memory budget (128 MB). No partial attachment will be included.');
          pages.push({ type: 'image', data, width: canvas.width, height: canvas.height, name: meta.name + ' — page ' + number });
        } finally { canvas.width = canvas.height = 0; page.cleanup(); }
      }
      return { ...meta, status: 'ready', kind: 'pdf', pages };
    } catch (error) {
      signal?.throwIfAborted();
      throw new Error('Could not render this PDF. It may be password-protected, damaged, or too large. ' + error.message);
    } finally { signal?.removeEventListener('abort', abort); await task.destroy(); }
  }
  if (meta.kind === 'pdf' || meta.mime === 'application/pdf') throw new Error('The platform returned something other than PDF file bytes.');
  if (meta.kind === 'pptx') return {...meta,status:'ready',...await presentationBlocks(buffer,{signal,onProgress,rasterize})};
  if (meta.kind === 'docx' || /wordprocessingml/.test(meta.mime)) {
    const result = await workerJob('./docx-worker.js', { buffer }, { signal, timeout: 60000 });
    return { ...meta, status: 'ready', kind: 'docx', blocks: await documentBlocks(result.html, signal),
      warnings: result.warnings.length ? ['Some DOCX features were not supported by the converter. Review its rendering.'] : [] };
  }
  if (meta.kind === 'image' || /^image\/(png|jpeg|gif|webp)$/.test(meta.mime)) {
    return { ...meta, status: 'ready', kind: 'image', ...await rasterize(new Blob([buffer], { type: meta.mime }), signal) };
  }
  if (['txt','md','csv','json','html','svg','js','py','css','log','xml','yaml','yml','ts','sql'].includes(meta.kind)) {
    if (buffer.byteLength > 8 * 1024 * 1024) throw new Error('Text artifact exceeds the safe rendering size (8 MB).');
    // BOM-marked Windows text is common; unknown encodings fail rather than losing characters.
    const encoding=bytes[0]===0xff&&bytes[1]===0xfe?'utf-16le':bytes[0]===0xfe&&bytes[1]===0xff?'utf-16be':'utf-8';
    const text=new TextDecoder(encoding,{fatal:true}).decode(buffer);
    if(text.includes('\0'))throw new Error('The attachment contains binary data, not supported text.');
    // HTML, SVG and executable artifacts are printed as source, never run.
    return { ...meta, status: 'ready', kind: 'artifact', sourceKind: meta.kind, blocks: [{ type: 'code', language: meta.kind, text }] };
  }
  throw new Error('This attachment format is not yet supported.');
}
