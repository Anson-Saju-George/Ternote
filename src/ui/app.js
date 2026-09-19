import { PLATFORMS, platformFor, preferences } from '../platforms.js';
import { captureConversation, cancelCapture, readCaptureBatch, readCaptureAsset, readCapturePreview, touchCapture } from '../extract.js';
import { exportConversation, prepareConversation, filename, messageText } from '../exporters.js';
import { renderAsset, openPdf } from '../assets.js';
import { createPdf } from '../pdf.js';
import { resolveNativeFile } from '../native-file.js';
import { verifyOfficeFile } from '../office-file.js';
import { detectedAttachmentTypes } from '../attachment-selection.js';
import { captureSlidePreview } from '../slide-preview.js';
const $ = id => document.getElementById(id);
const api = globalThis.chrome?.runtime?.id ? chrome : null;
const query = new URLSearchParams(location.search);
let conversation, tab, platform, busy = false, previewUrl, operation, captureToken, heartbeat;
let sourceUrl, revision = 0, pdfCache, pdfTask, previewPdf, pageNumber = 1, pageRender, previewGeneration = 0;
let selectionInitialized = false;
const originals = new Map();
function showOriginals() {
  $('originalFiles').replaceChildren(); $('originalFiles').hidden = !originals.size;
  if(!originals.size)return;
  const hint=document.createElement('p');hint.className='hint';hint.textContent='Save the original presentation. Exports use complete readable slide previews, never reconstructed text. Originals cannot be saved while text redaction is enabled.';
  $('originalFiles').append(hint);
  for(const {name,blob} of originals.values()) {
    const button=document.createElement('button');button.className='secondary';button.textContent='Save original — '+name;
    button.disabled=busy||!!$('redact').value.trim();
    button.onclick=()=>{if(busy||$('redact').value.trim())return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename(name.replace(/\.pptx$/i,''),'pptx');a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);};
    $('originalFiles').append(button);
  }
}
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function progress({ stage, count, current, total }) {
  const suffix = total ? ' — ' + current + ' / ' + total : count !== undefined ? ' — ' + count + ' messages' : '';
  $('progressLabel').textContent = stage + suffix;
  $('progress').hidden = false;
  if (total) { $('progressBar').max = total; $('progressBar').value = current; }
  else $('progressBar').removeAttribute('value');
  status('Keep this view open. You can cancel at any time.');
}
function setBusy(value) {
  busy = value;
  for (const id of ['preview','export','range','format','theme','metadata','redact','filename','settingsToggle','attachmentsToggle']) $(id).disabled = value;
  $('cancel').hidden = !value; $('progress').hidden = !value;
  $('selection').inert = value;
  $('attachmentPanel').inert = value;
  $('shell').setAttribute('aria-busy', String(value));
  showOriginals();
}
function currentOptions() {
  return { range: $('range').value, selected: [...$('selection').querySelectorAll('input:checked')].map(e => Number(e.value)), metadata: $('metadata').checked, redact: $('redact').value,
    includeImages:$('includeImages').checked, attachmentTypes:[...$('attachmentTypes').querySelectorAll('input:checked')].map(e=>e.value) };
}
function initializeAttachments() {
  $('attachmentTypes').replaceChildren(); $('includeImages').checked=true;
  const types=detectedAttachmentTypes(conversation?.assets).filter(([type])=>type!=='image');
  for(const [type,count] of types) {
    const label=document.createElement('label'), input=document.createElement('input');label.className='check';
    input.type='checkbox';input.value=type;input.checked=true;label.append(input,document.createTextNode(type.toUpperCase()+' ('+count+')'));
    $('attachmentTypes').append(label);
  }
  if(!types.length)$('attachmentTypes').textContent='No other attachment types detected.';
}
async function save() {
  if (api) await api.storage.local.set({ preferences: preferences({ format: $('format').value, theme: $('theme').value, metadata: $('metadata').checked, showButton: $('showButton').checked }) });
}
function showNotice(c) {
  const problems = [...(c.capture?.warnings || []), ...(c.assets || []).filter(a => a.status !== 'ready').map(a => a.name + ': ' + a.error), ...(c.assets||[]).flatMap(a=>(a.warnings||[]).map(w=>a.name+': '+w))];
  const unique = [...new Set(problems)];
  const included = c.assets?.filter(a => a.status === 'ready').length || 0;
  $('notice').textContent = c.messages.length + ' messages captured' + (included ? ' · ' + included + ' attachments included' : '') + '. ' +
    (unique.length ? unique.join(' ') : 'Reached both ends of the page. Review the export; platforms can withhold history or files.');
  $('notice').hidden = false;
}
async function initializeSelection() {
  if (selectionInitialized || !conversation) return;
  $('selection').replaceChildren();
  for (let i = 0; i < conversation.messages.length; i += 100) {
    const fragment = document.createDocumentFragment();
    for (let n = i; n < Math.min(i + 100, conversation.messages.length); n++) {
      const m = conversation.messages[n], label = document.createElement('label'), input = document.createElement('input'), span = document.createElement('span');
      input.type = 'checkbox'; input.value = n; input.checked = true;
      span.textContent = m.role + ': ' + messageText(m).slice(0,100); label.append(input,span); fragment.append(label);
    }
    $('selection').append(fragment);
    await new Promise(resolve => setTimeout(resolve,0));
  }
  selectionInitialized = true;
}
function invalidate() { pdfCache = undefined; closePreview(); }
function closePreview() {
  previewGeneration++; pageRender?.cancel(); pageRender = undefined;
  if (pdfTask) void pdfTask.destroy(); pdfTask = undefined; previewPdf = undefined;
  $('pdfCanvas').width = $('pdfCanvas').height = 0; $('pdfPreview').hidden = true;
  $('pageLabel').textContent = '';
  if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = undefined;
  $('previewFrame').removeAttribute('src'); $('previewPanel').hidden = true;
}
async function inject(func, args = []) {
  const result = await api.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  if (!result[0] || result[0].error) throw new Error(result[0]?.error?.message || 'The chat could not be read.');
  return result[0].result;
}
async function releaseCapture() {
  clearInterval(heartbeat); heartbeat = undefined;
  const token = captureToken; captureToken = undefined;
  if (token && tab && api) await inject(cancelCapture, [token]).catch(() => {});
}
async function ensureConversation(signal) {
  if (!api) throw new Error('Open the extension on ChatGPT, Claude or Gemini.');
  const active = query.has('tab') ? await api.tabs.get(Number(query.get('tab'))) : (await api.tabs.query({ active: true, currentWindow: true }))[0];
  const nextPlatform = platformFor(active?.url);
  if (!nextPlatform) throw new Error('Open ChatGPT, Claude or Gemini, then click the extension.');
  if (!await api.permissions.contains({ origins: [nextPlatform.origin] })) { $('settings').hidden = false; throw new Error('Enable ' + nextPlatform.name + ' in settings, then try again.'); }
  tab = active; platform = nextPlatform;
  if (conversation && sourceUrl === tab.url) return;
  conversation = undefined; originals.clear();showOriginals();invalidate();
  captureToken = crypto.randomUUID();
  progress({ stage: 'Loading the entire conversation', count: 0 });
  heartbeat = setInterval(() => { if (captureToken) void inject(touchCapture,[captureToken]).catch(() => {}); }, 5000);
  try {
    const summary = await inject(captureConversation, [platform, { token: captureToken, stream: true, nativeFiles: true, nativePreviews:true }]);
    signal.throwIfAborted();
    if (!summary) throw new Error('Capture returned no content. Reload the chat and retry.');
    const c = { ...summary, messages: [] }; delete c.token;
    // Tests may return an in-memory fixture. Production transfers bounded batches.
    if (summary.messages) c.messages = summary.messages;
    else {
      let offset = 0;
      while (true) {
        signal.throwIfAborted(); progress({ stage: 'Transferring messages', current: offset, total: summary.capture.messageCount });
        const batch = await inject(readCaptureBatch, [captureToken, offset]);
        if (!batch.messages.length && !batch.done) throw new Error('Message transfer stalled.');
        c.messages.push(...batch.messages); offset = batch.next;
        if (batch.done) break;
      }
    }
    const rendered = []; let totalSize = 0;
    for (let index = 0; index < (summary.assets || []).length; index++) {
      signal.throwIfAborted();
      const meta = summary.assets[index];
      progress({ stage: 'Preparing ' + meta.name, current: index + 1, total: summary.assets.length });
      if (meta.error && !meta.previewPages?.length) { rendered.push({ ...meta, status: 'unavailable' }); continue; }
      try {
        if (totalSize >= 256 * 1024 * 1024) throw new Error('Rendered attachments exceed the safe memory budget (256 MB).');
        const parts = []; let offset = 0;
        while (!meta.error) {
          signal.throwIfAborted();
          const part = await inject(readCaptureAsset, [captureToken, meta.id, offset]);
          parts.push(Uint8Array.from(atob(part.base64), c => c.charCodeAt(0))); offset = part.next;
          if (part.done) break;
        }
        const buffer = await new Blob(parts).arrayBuffer(); parts.length = 0;
        if(!meta.error&&(meta.kind==='docx'||meta.kind==='pptx'))verifyOfficeFile(buffer,meta.kind);
        if(meta.kind==='pptx') {
          totalSize+=buffer.byteLength;
          if(totalSize>256*1024*1024)throw new Error('Attachments exceed the safe memory budget (256 MB).');
          if(!meta.error)originals.set(meta.id,{name:meta.name,blob:new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'})});
          if(!meta.previewPages?.length)throw new Error(meta.previewError||'Original slide previews were not available. Open the presentation in ChatGPT and retry. No reflowed text was substituted.');
          const pages=[];
          for(let pageIndex=0;pageIndex<meta.previewPages.length;pageIndex++) {
            const chunks=[];let next=0;
            while(true){signal.throwIfAborted();const part=await inject(readCapturePreview,[captureToken,meta.id,pageIndex,next]);chunks.push(Uint8Array.from(atob(part.base64),c=>c.charCodeAt(0)));next=part.next;if(part.done)break;}
            const slide=await renderAsset({kind:'image',mime:'image/png',name:meta.name+' — slide '+(pageIndex+1)},await new Blob(chunks).arrayBuffer(),{signal});
            totalSize+=slide.data.length;if(totalSize>256*1024*1024)throw new Error('Rendered slide previews exceed the safe memory budget.');
            pages.push({type:'image',name:slide.name,data:slide.data,width:slide.width,height:slide.height});
          }
          const {previewPages,previewError,error,...details}=meta;
          rendered.push({...details,status:'ready',pages,slidePreviews:true,warnings:['Slides captured from ChatGPT previews; preview resolution and fidelity depend on the platform.',...(error?['Original presentation download unavailable.']:[])]});
          continue;
        }
        const result = await renderAsset(meta, buffer, { signal, onProgress: progress });
        totalSize += JSON.stringify(result).length;
        if (totalSize > 256 * 1024 * 1024) throw new Error('Rendered attachments exceed the safe memory budget (256 MB).');
        rendered.push(result);
      } catch (error) { signal.throwIfAborted(); rendered.push({ ...meta, status: 'unavailable', error: error.message }); }
    }
    signal.throwIfAborted();
    c.assets = rendered; conversation = c; sourceUrl = tab.url; revision++; pdfCache = undefined;
    selectionInitialized = false; $('selection').replaceChildren(); $('filename').value = c.title;
    initializeAttachments();showNotice(c);
  } finally { if(!conversation){originals.clear();showOriginals();} await releaseCapture(); }
}
function prepared() {
  if (!conversation) throw new Error('Load a conversation first.');
  return prepareConversation(conversation, currentOptions());
}
async function pdfBlob(signal) {
  const key = JSON.stringify({ revision, options: currentOptions(), theme: $('theme').value });
  if (pdfCache?.key === key) return pdfCache.blob;
  progress({ stage: 'Formatting the PDF' });
  const blob = await createPdf(prepared(), $('theme').value, { signal, onProgress: progress });
  signal.throwIfAborted(); pdfCache = { key, blob }; return blob;
}
async function showPdfPage(number) {
  if (!previewPdf || number < 1 || number > previewPdf.numPages) return;
  const generation = previewGeneration;
  pageRender?.cancel();
  $('previousPage').disabled = $('nextPage').disabled = true;
  const page = await previewPdf.getPage(number);
  if (generation !== previewGeneration) return;
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(1.8, 1000 / base.width) });
  const canvas = $('pdfCanvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  pageRender = page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' });
  try {
    await pageRender.promise;
    if (generation !== previewGeneration) return;
    pageNumber = number; $('pageLabel').textContent = number + ' / ' + previewPdf.numPages;
    canvas.setAttribute('aria-label', 'PDF page ' + number + ' of ' + previewPdf.numPages);
    $('previousPage').disabled = number === 1; $('nextPage').disabled = number === previewPdf.numPages;
  } catch (e) { if (e.name !== 'RenderingCancelledException') throw e; }
  finally { page.cleanup(); }
}
async function preview(signal) {
  closePreview();
  if ($('format').value === 'pdf') {
    const blob = await pdfBlob(signal); signal.throwIfAborted();
    pdfTask = await openPdf(await blob.arrayBuffer());
    previewPdf = await pdfTask.promise; signal.throwIfAborted();
    $('previewFrame').hidden = true; $('pdfPreview').hidden = false; $('previewPanel').hidden = false;
    await showPdfPage(1); status('This is the actual PDF. Export downloads the same document.');
  } else {
    const result = exportConversation(prepared(), 'html', $('theme').value);
    previewUrl = URL.createObjectURL(new Blob([result.text], { type: result.mime }));
    $('previewFrame').hidden = false; $('previewFrame').src = previewUrl; $('previewPanel').hidden = false;
    status('Preview includes your selected messages and accessible attachments.');
  }
}
function saveBlob(blob, extension) {
  const url = URL.createObjectURL(blob);
  const safeTitle = $('redact').value.split('\n').map(s => s.trim()).filter(Boolean).reduce((s,t) => s.split(t).join('[redacted]'), $('filename').value || conversation.title);
  const a = document.createElement('a'); a.href = url; a.download = filename(safeTitle, extension);
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function run(action) {
  if (busy) return;
  operation = new AbortController(); const signal = operation.signal; setBusy(true);
  try {
    await ensureConversation(signal);
    if ($('range').value === 'selected') await initializeSelection();
    signal.throwIfAborted();
    if (action === 'capture') { status('Conversation loaded. Choose Preview or Export.'); return; }
    if (action === 'preview') await preview(signal);
    else {
      if ($('format').value === 'pdf') {
        const blob = await pdfBlob(signal); signal.throwIfAborted(); saveBlob(blob, 'pdf');
        status('PDF download requested. No print dialog or upload.');
      } else {
        const result = exportConversation(prepared(), $('format').value, $('theme').value);
        saveBlob(new Blob([result.text], { type: result.mime }), result.extension);
        status('Download requested. Your conversation stayed on this device.');
      }
      await save();
    }
  } catch (e) {
    if (signal.aborted) status('Cancelled. No incomplete export was downloaded.');
    else status(e.message || 'Unable to export this conversation.', true);
  } finally { await releaseCapture(); operation = undefined; setBusy(false); }
}
async function cancel() { operation?.abort(); await releaseCapture(); }
async function renderPlatforms() {
  $('platforms').replaceChildren();
  for (const p of PLATFORMS) {
    const enabled = api && await api.permissions.contains({ origins: [p.origin] });
    const row = document.createElement('div'), name = document.createElement('span'), button = document.createElement('button');
    row.className = 'platform'; name.textContent = p.name; button.className = 'secondary'; button.textContent = enabled ? 'Disconnect' : 'Enable'; button.disabled = !api;
    button.onclick = async () => {
      if (busy) return;
      try {
        if (enabled) await api.permissions.remove({ origins: [p.origin] });
        else if (!await api.permissions.request({ origins: [p.origin] })) { status('Site access was not granted.'); return; }
        await api.runtime.sendMessage({ type: 'reconcile' });
        if (!enabled) {
          for (const t of await api.tabs.query({ url: p.origin })) await api.scripting.executeScript({ target: { tabId: t.id }, files: ['src/button.js'] }).catch(() => {});
        } else { conversation = undefined; originals.clear();showOriginals();invalidate(); $('notice').hidden = true; }
        await renderPlatforms(); status(enabled ? p.name + ' disconnected.' : p.name + ' enabled. Preview or export when ready.');
      } catch { status('Could not change platform access. Retry from the extension popup.', true); }
    };
    row.append(name,button); $('platforms').append(row);
  }
}
api?.runtime.onMessage.addListener((message, sender, reply) => {
  if(busy&&sender.id===api.runtime.id&&sender.tab?.id===tab?.id&&sender.frameId===0&&message.type==='native-slide-request'&&message.token===captureToken&&message.url===tab.url&&platform?.id==='chatgpt'&&typeof message.assetId==='string'&&message.marker===captureToken+':'+message.assetId&&typeof message.name==='string'&&message.name.length<=200) {
    api.scripting.executeScript({target:{tabId:tab.id},func:captureSlidePreview,args:[message.marker,message.name,message.token,message.assetId,message.url,message.budget]})
      .then(result=>reply(result[0]?.result||{error:'No slide preview result.'}),()=>reply({error:'Unable to access the slide preview.'}));return true;
  }
  if (busy && sender.id===api.runtime.id && sender.tab?.id===tab?.id && sender.frameId===0 && message.type==='native-file-request' && message.token===captureToken && message.url===tab.url && platform?.id==='chatgpt' && typeof message.marker==='string' && message.marker.startsWith(captureToken+':asset-') && typeof message.name==='string' && message.name.length<=200) {
    api.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:resolveNativeFile,args:[message.marker,message.name,message.url]})
      .then(result=>reply(result[0]?.result||{error:'No file viewer result.'}),()=>reply({error:'Unable to access the native file viewer.'}));
    return true;
  }
  if (busy && sender.id === api.runtime.id && sender.tab?.id === tab?.id && message.type === 'capture-progress' && message.token === captureToken) progress(message);
});
api?.permissions.onRemoved.addListener(() => { void cancel(); conversation = undefined; originals.clear();showOriginals();invalidate(); });
$('preview').onclick = () => run('preview'); $('export').onclick = () => run('download'); $('cancel').onclick = cancel;
$('previousPage').onclick = () => showPdfPage(pageNumber - 1).catch(e => status(e.message,true));
$('nextPage').onclick = () => showPdfPage(pageNumber + 1).catch(e => status(e.message,true));
$('settingsToggle').onclick = () => { $('settings').hidden = !$('settings').hidden; };
$('attachmentsToggle').onclick = async () => {
  if(!conversation)await run('capture');
  if(!conversation)return;
  $('attachmentPanel').hidden=!$('attachmentPanel').hidden;
  $('attachmentsToggle').setAttribute('aria-expanded',String(!$('attachmentPanel').hidden));
};
$('attachmentPanel').addEventListener('change',invalidate);
$('range').onchange = async () => {
  invalidate();
  if ($('range').value === 'selected') {
    if (!conversation) await run('capture');
    if (!conversation) $('range').value = 'all';
    else await initializeSelection();
  }
  $('selection').hidden = $('range').value !== 'selected';
};
$('closePreview').onclick = closePreview;
for (const id of ['format','theme','metadata','showButton']) $(id).addEventListener('change', () => { invalidate(); save().catch(() => status('Could not save preferences.', true)); });
$('redact').addEventListener('input', () => { invalidate(); if ($('redact').value.trim()) status('Exact-text redaction omits images and attached PDF pages; their pixels cannot be safely text-redacted.'); });
$('redact').addEventListener('input',showOriginals);
$('selection').addEventListener('change', invalidate);
window.addEventListener('pagehide', () => { void cancel(); closePreview(); conversation = undefined; originals.clear();pdfCache = undefined; });
async function init() {
  if (api) {
    const state = await api.storage.local.get('preferences'), p = preferences(state.preferences);
    $('format').value = p.format; $('theme').value = p.theme; $('metadata').checked = p.metadata; $('showButton').checked = p.showButton;
  }
  await renderPlatforms();
  if (query.has('settings')) $('settings').hidden = false;
  document.documentElement.dataset.ready = 'true';
  if (query.has('tab')) await run('capture');
}
init().catch(() => status('Initialization failed. Reopen the extension.', true));
