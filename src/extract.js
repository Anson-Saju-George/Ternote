// This function is injected into the enabled page. Keep it self-contained.
export async function captureConversation(config, options = {}) {
  if (location.protocol !== 'https:' || location.hostname !== config.host) throw new Error('The page changed. Open the conversation and retry.');
  globalThis.__personalExportCapture?.dispose();
  const originalUrl = location.href, controller = new AbortController();
  const token = options.token || crypto.randomUUID(), records = new Map(), assets = new Map(), assetUrls = new Map();
  const warnings = new Set(), identities = new WeakMap(), parsed = new WeakMap(), dirty = new WeakSet();
  const expanded = [], clicked = new WeakSet(), historyClicks = new WeakMap();
  let head, tail, sequence = 0, version = 0, rawBytes = 0, textBytes = 0, disposed = false;
  const handle = {
    token, controller, assets, messages: [], lastAccess: Date.now(),
    cancel: () => controller.abort(),
    dispose: () => { disposed = true; controller.abort(); for (const a of assets.values()) if(a.marker && a.element?.getAttribute('data-ternote-file')===a.marker)a.element.removeAttribute('data-ternote-file'); assets.clear(); handle.messages = []; clearInterval(lease); globalThis.chrome?.storage?.onChanged.removeListener(onPermissions); if (globalThis.__personalExportCapture === handle) delete globalThis.__personalExportCapture; }
  };
  globalThis.__personalExportCapture = handle;
  // A closed/reloaded export view must not leave conversation data or an orphaned job on the page.
  const lease = setInterval(() => { if (Date.now() - handle.lastAccess > 30000) handle.dispose(); }, 5000);
  function check() {
    if (controller.signal.aborted || disposed) throw new Error('Capture cancelled.');
    if (location.href !== originalUrl) throw new Error('Conversation changed during capture. Retry.');
  }
  function progress(stage, extra = {}) {
    const message = { type: 'capture-progress', token, stage, count: records.size, assets: assets.size, ...extra };
    try { globalThis.chrome?.runtime?.sendMessage(message)?.catch(() => {}); } catch {}
    if (!options.stream) handle.lastAccess = Date.now();
  }
  function onPermissions(changes, area) {
    if (area === 'local' && changes.enabled?.newValue?.[config.id] === false) handle.dispose();
  }
  globalThis.chrome?.storage?.onChanged.addListener(onPermissions);
  const skip = 'script,style,noscript,iframe,object,embed,input,textarea,select,nav,svg,[hidden],[aria-hidden="true"],[contenteditable="true"],[data-personal-exporter]';
  function visible(el) {
    if (el.closest(skip)) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || s.contentVisibility === 'hidden') return false;
      if (n.parentElement?.tagName === 'DETAILS' && !n.parentElement.open && n.tagName !== 'SUMMARY') return false;
    }
    return true;
  }
  function messageElements() {
    for (const selector of config.selectors) {
      const candidates = [...document.querySelectorAll(selector)].filter(e => visible(e) && e.getClientRects().length);
      const set = new Set(candidates);
      const roots = candidates.filter(e => { for (let p = e.parentElement; p; p = p.parentElement) if (set.has(p)) return false; return true; });
      if (roots.length) return roots;
    }
    return [];
  }
  function plain(root) {
    if (root.nodeType === Node.TEXT_NODE) return root.textContent;
    if (root.nodeType !== Node.ELEMENT_NODE || !visible(root)) return '';
    if (root.tagName === 'BR') return '\n';
    if (root.tagName === 'IMG' || root.matches('button,[role="button"]')) return '';
    return [...root.childNodes].map(plain).join('');
  }
  function safeUrl(value) {
    try {
      const url = new URL(value, location.href);
      if (url.username || url.password) return;
      if (url.protocol === 'data:' && /^data:(image\/(png|jpeg|webp|gif)|application\/(pdf|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/(plain|markdown))[;,]/i.test(value)) return url.href;
      if (url.protocol === 'blob:' && url.origin === location.origin) return url.href;
      // Only resources already referenced by the conversation DOM. Never internal addresses or private APIs discovered from app state.
      if (url.protocol !== 'https:' || /(^localhost$|\.local$|^\[|^\d+\.\d+\.\d+\.\d+$)/i.test(url.hostname)) return;
      return url.href;
    } catch {}
  }
  function asset(root, kind, value, name) {
    const url = value && safeUrl(value), key = url || root;
    if (assetUrls.has(key)) return assetUrls.get(key);
    const id = 'asset-' + (assets.size + 1);
    assets.set(id, { id, kind, name: (name || (kind === 'image' ? 'Image' : 'Attachment')).slice(0,200), url, element: root });
    assetUrls.set(key, id);
    return id;
  }
  function resourceBlock(el) {
    if (el.tagName === 'IMG') {
      if (/avatar|profile picture/i.test(el.alt || '')) return null;
      return { type: 'asset', assetId: asset(el, 'image', el.currentSrc || el.src || el.dataset.src, el.alt), name: el.alt || 'Image' };
    }
    if (el.tagName === 'A') {
      const label = el.getAttribute('download') || plain(el) || 'Attachment';
      const url = el.getAttribute('href') || '';
      const ext = (label.match(/\.(pdf|docx|pptx|txt|md|csv|json|html|svg|js|py|css|log|xml|yaml|yml|ts|sql)\b/i) || url.split(/[?#]/)[0].match(/\.(pdf|docx|pptx|txt|md|csv|json|html|svg|js|py|css|log|xml|yaml|yml|ts|sql)$/i))?.[1]?.toLowerCase();
      if (ext || el.hasAttribute('download')) {
        return { type: 'asset', assetId: asset(el, ext || 'unknown', url, label), name: label };
      }
    }
    return null;
  }
  function blocks(root, depth = 0) {
    if (depth > 100) { warnings.add('Some deeply nested content could not be read.'); return []; }
    const output = []; let pending = '';
    const flush = () => { if (pending.trim()) output.push({ type: 'paragraph', text: pending.trim() }); pending = ''; };
    for (const child of root.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) { pending += child.textContent; continue; }
      if (child.nodeType !== Node.ELEMENT_NODE || !visible(child)) continue;
      const tag = child.tagName, resource = resourceBlock(child);
      if (resource) { flush(); output.push(resource); }
      // ChatGPT image previews are buttons. Read their images without exporting control labels.
      else if (child.matches('button,[role="button"]')) {
        for (const img of child.querySelectorAll('img')) if (visible(img)) { flush(); const b = resourceBlock(img); if (b) output.push(b); }
        const name = (child.innerText || child.textContent || '').trim();
        const fileName = name.replace(/\s+/g,' ').match(/^(.+?\.(pdf|docx|pptx|txt|md|csv|json|html|svg|js|py|css|log|xml|yaml|yml|ts|sql))(?:$|\s+(?:Open file|Presentation|Document|PDF|Text|Spreadsheet|File|Code|JSON)(?:\s+file)?$)/i);
        if (options.nativeFiles && config.id==='chatgpt' && fileName && fileName[1].length<=200 && !child.querySelector('img') && child.closest('[data-message-author-role]')) {
          flush(); const id=asset(child,fileName[2].toLowerCase(),null,fileName[1]);
          assets.get(id).native=true;
          output.push({type:'asset',assetId:id,name:fileName[1]});
        } else if (/\.(pdf|docx?|pptx?|xlsx?|odt|ods|odp|epub|zip|csv|txt|md)\b/i.test(name)) {
          const kind=name.match(/\.(pdf|docx?|pptx?|xlsx?|odt|ods|odp|epub|zip|csv|txt|md)\b/i)[1].toLowerCase();
          const id=asset(child,kind,null,name);Object.assign(assets.get(id),{attempted:true,error:'File card detected, but its contents cannot be retrieved by this build.'});
          delete assets.get(id).element;
          flush(); output.push({type:'asset',assetId:id,name:name.slice(0,200)});
          warnings.add('File cards were found without readable URLs. Their contents are not included in this export yet.');
        }
      }
      else if (tag === 'PRE') { flush(); const code = child.querySelector('code') || child; output.push({ type: 'code', text: plain(code), language: code.className?.match?.(/language-([\w+-]+)/)?.[1] || '' }); }
      else if (/^H[1-6]$/.test(tag)) { flush(); output.push({ type: 'heading', level: Number(tag[1]), text: plain(child) }); }
      else if (tag === 'TABLE') { flush(); output.push({ type: 'table', rows: [...child.rows].filter(visible).map(r => [...r.cells].map(plain)) }); for (const img of child.querySelectorAll('img')) if (visible(img)) { const b = resourceBlock(img); if(b)output.push(b); } }
      else if (tag === 'UL' || tag === 'OL') { flush(); output.push({ type: 'list', ordered: tag === 'OL', items: [...child.children].filter(visible).map(plain) }); for (const img of child.querySelectorAll('img')) if (visible(img)) { const b = resourceBlock(img); if(b)output.push(b); } }
      else if (tag === 'BLOCKQUOTE') { flush(); output.push({ type: 'quote', text: plain(child) }); }
      else if (tag === 'BR') pending += '\n';
      else if (child.children.length || ['P','DIV','SECTION','ARTICLE','DETAILS'].includes(tag)) { flush(); output.push(...blocks(child, depth + 1)); }
      else pending += plain(child);
    }
    flush(); return output;
  }
  function identity(el, role) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      for (const attr of ['data-message-id','data-turn-id','id']) {
        const value = n.getAttribute(attr);
        if (value && (n === el || n.matches('article,[data-message-id],[data-turn-id]'))) return 'stable:' + attr + ':' + value + ':' + role;
      }
    }
    if (!identities.has(el)) identities.set(el, 'node:' + (++sequence));
    return identities.get(el);
  }
  function insert(record, previous, next) {
    if (previous) {
      record.prev = previous; record.next = previous.next;
      if (previous.next) previous.next.prev = record; else tail = record;
      previous.next = record;
    } else if (next) {
      record.next = next; record.prev = next.prev;
      if (next.prev) next.prev.next = record; else head = record;
      next.prev = record;
    } else {
      record.prev = tail; if (tail) tail.next = record; else head = record; tail = record;
    }
  }
  async function fetchNewAssets() {
    for (const a of assets.values()) {
      if (a.attempted) continue;
      check(); a.attempted = true;
      progress('Reading images and attachments');
      try {
        if (rawBytes >= 256 * 1024 * 1024) throw new Error('Attachment memory budget reached (256 MB).');
        if(a.native) {
          progress('Opening the attachment viewer');
          a.marker=token+':'+a.id;a.element.setAttribute('data-ternote-file',a.marker);
          const result=await new Promise((resolve,reject)=>{
            const aborted=()=>finish(new Error('Capture cancelled.'));
            const timer=setTimeout(()=>finish(new Error('The attachment viewer timed out. Open the file in ChatGPT and retry.')),15000);
            function finish(error,value){clearTimeout(timer);controller.signal.removeEventListener('abort',aborted);error?reject(error):resolve(value);}
            controller.signal.addEventListener('abort',aborted,{once:true});
            Promise.resolve().then(()=>globalThis.chrome.runtime.sendMessage({type:'native-file-request',token,marker:a.marker,name:a.name,url:originalUrl})).then(value=>finish(null,value),()=>finish(new Error('The export view could not read the native file viewer.')));
          });
          check();
          if(!result?.url)throw new Error(result?.error||'The native file is unavailable.');
          const url=new URL(result.url);
          if(url.origin!==location.origin || url.protocol!=='https:' || url.username || url.password)throw new Error('The native download URL is not supported.');
          a.url=url.href;
        }
        // Snapshot already loaded, origin-clean images before a virtualized page removes them.
        if (a.kind === 'image' && a.element.complete && a.element.naturalWidth) {
          try {
            const image = a.element, scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            a.blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            canvas.width = canvas.height = 0;
          } catch {}
        }
        if (!a.blob) {
          if (!a.url) throw new Error('No accessible file URL is exposed by this attachment.');
          const timeout = AbortSignal.timeout(45000);
          const response = await fetch(a.url, { signal: AbortSignal.any([controller.signal, timeout]), credentials: 'same-origin', referrerPolicy: 'no-referrer', redirect: 'error' });
          if (!response.ok) throw new Error('The platform did not allow this file to be read (HTTP ' + response.status + ').');
          const mime = response.headers.get('content-type')?.split(';')[0] || '';
          const limit = Math.min(64 * 1024 * 1024, 256 * 1024 * 1024 - rawBytes);
          if (Number(response.headers.get('content-length')) > limit) throw new Error('File exceeds the safe in-memory size (up to 64 MB per file).');
          const reader = response.body.getReader(), chunks = []; let bytes = 0;
          try {
            while (true) {
              check(); const { value, done } = await reader.read(); if (done) break;
              bytes += value.byteLength;
              if (bytes > limit) throw new Error('File exceeds the safe in-memory size (up to 64 MB per file).');
              chunks.push(value);
            }
          } finally { await reader.cancel().catch(() => {}); }
          a.blob = new Blob(chunks, { type: mime });
        }
        if (!a.blob || a.blob.size > 64 * 1024 * 1024 || rawBytes + a.blob.size > 256 * 1024 * 1024) throw new Error('Attachment exceeds the safe in-memory size.');
        rawBytes += a.blob.size;
      } catch (e) {
        check(); a.blob = undefined;
        a.error = e.name === 'TypeError' ? 'The platform blocked access to this file (CORS, expired link, or login required).' : e.message;
        warnings.add(a.name + ': ' + a.error);
      } finally {
        try {
          if(a.native&&a.kind==='pptx'&&options.nativePreviews&&!controller.signal.aborted) {
            const result=await new Promise((resolve,reject)=>{
              const aborted=()=>finish(new Error('Capture cancelled.'));
              const timer=setTimeout(()=>finish(new Error('Slide preview capture timed out.')),310000);
              function finish(error,value){clearTimeout(timer);controller.signal.removeEventListener('abort',aborted);error?reject(error):resolve(value);}
              controller.signal.addEventListener('abort',aborted,{once:true});
              Promise.resolve().then(()=>globalThis.chrome.runtime.sendMessage({type:'native-slide-request',token,marker:a.marker,name:a.name,assetId:a.id,url:originalUrl,budget:Math.min(64*1024*1024,256*1024*1024-rawBytes)})).then(value=>finish(null,value),()=>finish(new Error('Unable to inspect the slide viewer.')));
            });
            check();
            if(result?.error||!a.previewPages?.length)a.previewError=result?.error||'Original slide previews could not be captured.';
            else rawBytes+=result.bytes;
          }
        }catch(error){a.previewError=error.message;delete a.previewPages;}
        finally {if(a.marker && a.element?.getAttribute('data-ternote-file')===a.marker)a.element.removeAttribute('data-ternote-file'); delete a.element; delete a.url; delete a.marker;}
      }
    }
  }
  function expansionControls(el) {
    return [...el.querySelectorAll('button,[role="button"]')].filter(button => {
      if (button.disabled || button.getAttribute('type') === 'submit' || !button.getClientRects().length) return false;
      const label = (button.getAttribute('aria-label') || button.textContent || '').trim();
      const expandedState = button.getAttribute('aria-expanded');
      if (expandedState === 'true') return false;
      if (!/^(show more|read more|expand|expand message|show full message|show code|show thinking|show reasoning|view artifact|open artifact|thought for \d+[\w\s.]*|thinking|reasoning)$/i.test(label)) return false;
      const id = button.getAttribute('aria-controls'), target = id && document.getElementById(id);
      // Never activate unrelated dropdowns or controls outside a message's content.
      if (id && (!target || !(el.contains(target) || target.matches('[data-artifact-content],[data-testid="artifact-content"],[data-testid="artifact-panel"]')))) return false;
      return expandedState === 'false' || /^(show more|read more|expand message|show full message)$/i.test(label);
    });
  }
  async function expandContent(elements) {
    let changed = false;
    for (const el of elements) {
      for (const detail of el.querySelectorAll('details:not([open])')) {
        if (!clicked.has(detail)) { clicked.add(detail); expanded.push(() => { if (detail.isConnected) detail.open = false; }); detail.open = true; changed = true; }
      }
      for (const button of expansionControls(el)) {
        if (clicked.has(button) || !button.getClientRects().length) continue;
        clicked.add(button); button.click(); changed = true;
        expanded.push(() => { if (button.isConnected && (button.getAttribute('aria-expanded') === 'true' || /^(show less|read less|collapse message)$/i.test(button.textContent.trim()))) button.click(); });
      }
    }
    if (changed) await pause(350);
  }
  async function collect() {
    check();
    let elements = messageElements();
    await expandContent(elements);
    elements = messageElements();
    const batch = [];
    for (const el of elements) {
      const role = config.user.some(s => el.matches(s)) ? 'user' : config.assistant.some(s => el.matches(s)) ? 'assistant' : 'unknown';
      let key = identity(el, role), previousParse = parsed.get(el);
      // Stable IDs are checked even when the element itself has been recycled.
      if (previousParse && !dirty.has(el) && previousParse.key === key) { batch.push(previousParse.record); continue; }
      const content = blocks(el);
      const signature = JSON.stringify(content);
      if (previousParse?.key === key && key.startsWith('node:') && previousParse.signature !== signature) {
        warnings.add('Some message containers changed without stable IDs; verify message order and duplicates.');
        key = 'node:' + (++sequence); identities.set(el, key);
      }
      let record = records.get(key);
      if (!record) {
        const model = el.getAttribute('data-message-model-slug') || el.getAttribute('data-model-name');
        const effort = el.getAttribute('data-reasoning-effort') || el.getAttribute('data-thinking-level');
        const timestamp = el.querySelector('time[datetime]')?.getAttribute('datetime');
        record = { key, message: { id: 'message-' + (records.size + 1), role, blocks: content,
          ...(model ? { model: model.slice(0,120) } : {}), ...(effort ? { effort: effort.slice(0,60) } : {}),
          ...(timestamp && Number.isFinite(Date.parse(timestamp)) ? { timestamp } : {}) } };
        records.set(key, record); version++;
      } else if (record.signature !== signature) { textBytes -= record.signature?.length || 0; version++; }
      else { parsed.set(el, { key, record, signature }); dirty.delete(el); batch.push(record); continue; }
      record.message.blocks = content; record.signature = signature; textBytes += signature.length;
      if (textBytes > 64 * 1024 * 1024) throw new Error('Chat exceeds this browser job’s safe text memory budget (64 million characters). Nothing has been silently truncated.');
      parsed.set(el, { key, record, signature }); dirty.delete(el); batch.push(record);
    }
    for (let i = 0; i < batch.length; i++) {
      const r = batch[i]; if (r === head || r.prev || r.next) continue;
      let next; for (let j = i + 1; j < batch.length; j++) if (batch[j] === head || batch[j].prev || batch[j].next) { next = batch[j]; break; }
      insert(r, i ? batch[i-1] : null, next);
    }
    // Read only already-exposed artifact panes, never execute artifacts or probe private endpoints.
    const artifactSelector='[data-artifact-content],[data-testid="artifact-content"],[data-testid="artifact-panel"]';
    for (const pane of document.querySelectorAll(artifactSelector)) {
      if (!visible(pane) || elements.some(el => el.contains(pane))) continue;
      if (pane.parentElement?.closest(artifactSelector)) continue;
      const key = 'artifact:' + (pane.id || pane.getAttribute('data-artifact-id') || identity(pane,'artifact'));
      const content = blocks(pane), signature = JSON.stringify(content);
      let record = records.get(key);
      if (!record) { record = { key, message: { id: key, role: 'artifact', blocks: content } }; records.set(key, record); insert(record, tail); version++; }
      if (record.signature !== signature) { record.message.blocks = content; record.signature = signature; version++; }
    }
    await fetchNewAssets();
    return elements;
  }
  async function pause(ms) {
    const until = performance.now() + ms;
    do { check(); await new Promise(resolve => setTimeout(resolve, Math.min(100, Math.max(0, until - performance.now())))); } while (performance.now() < until);
  }
  let scroller, observer, oldTop, oldBehavior;
  const pollMs = options.testTiming?.pollMs ?? 300;
  const edgeWait = options.testTiming?.edgeWait ?? 1800;
  try {
    let elements = messageElements();
    if (!elements.length) throw new Error('No supported message structure found. The site adapter may need an update.');
    scroller = document.scrollingElement;
    for (let p = elements[0].parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) { scroller = p; break; }
    }
    oldTop = scroller.scrollTop; oldBehavior = scroller.style.scrollBehavior; scroller.style.scrollBehavior = 'auto';
    observer = new MutationObserver(changes => {
      for (const change of changes) {
        let n = change.target.nodeType === Node.ELEMENT_NODE ? change.target : change.target.parentElement;
        for (; n; n = n.parentElement) if (parsed.has(n)) { dirty.add(n); break; }
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    await collect();
    for (const direction of [-1, 1]) {
      let settledSince, lastVersion = version, lastHeight = scroller.scrollHeight;
      while (true) {
        check();
        progress(direction < 0 ? 'Loading earlier messages' : 'Reading the entire conversation');
        const before = scroller.scrollTop, max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        const nextTop = direction < 0 ? Math.max(0, before - Math.max(100, scroller.clientHeight * .7)) : Math.min(max, before + Math.max(100, scroller.clientHeight * .7));
        scroller.scrollTop = nextTop;
        if(direction < 0 && nextTop === 0){
          const region=scroller===document.scrollingElement?document.querySelector('main')||document.body:scroller;
          const more=[...region.querySelectorAll('button')].find(b=>!b.disabled&&b.getClientRects().length&&/^(load|show) (older|earlier|previous|more) (messages|conversation|history)$/i.test(b.textContent.trim()));
          if(more&&historyClicks.get(more)!==version){historyClicks.set(more,version);more.click();settledSince=undefined;}
        }
        // Boundary events allow lazy-load handlers to run even when already at the edge.
        if (nextTop === before) scroller.dispatchEvent(new Event('scroll'));
        await pause(pollMs); await collect();
        const atEdge = direction < 0 ? scroller.scrollTop <= 1 : scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1;
        const loading = !!document.querySelector('[aria-busy="true"],[data-testid="loading-indicator"],[data-testid="conversation-loading"]');
        // Content-free diagnostics for capture stalls; disposed with the capture lease.
        handle.state = {direction,atEdge,loading,version,previousVersion:lastVersion,height:scroller.scrollHeight,previousHeight:lastHeight,count:records.size};
        if (atEdge && !loading && version === lastVersion && scroller.scrollHeight === lastHeight) {
          settledSince ??= performance.now();
          if (performance.now() - settledSince >= edgeWait) break;
        } else settledSince = undefined;
        lastVersion = version; lastHeight = scroller.scrollHeight;
      }
    }
    check();
    const elementsNow = messageElements();
    if (elementsNow.some(el => expansionControls(el).length)) warnings.add('A recognized message-expansion control did not open. Hidden content behind that control may be missing.');
    if ([...document.querySelectorAll('button')].some(b => /^(load|show) (older|earlier|previous|more) (messages|conversation|history)$/i.test(b.textContent.trim()) && b.getClientRects().length)) warnings.add('A load-history control remains. Open it and retry to include the earlier history.');
    for (let r = head; r; r = r.next) if (r.message.blocks.length) handle.messages.push(r.message);
    if (!handle.messages.length) throw new Error('No exportable message content was found.');
    const url = new URL(location.href);
    const models = [...new Set(handle.messages.map(m => m.model).filter(Boolean))];
    const efforts = [...new Set(handle.messages.map(m => m.effort).filter(Boolean))];
    const summary = {
      schemaVersion: 2, title: document.title || 'Conversation', platform: config.id, sourceUrl: url.origin + url.pathname,
      exportedAt: new Date().toISOString(), completeness: 'page-boundaries-reached',
      ...(models.length ? { model: models.join(', '), modelSource: 'message metadata' } : {}),
      ...(efforts.length ? { effort: efforts.join(', ') } : {}),
      capture: { method: 'scroll-and-collect', messageCount: handle.messages.length, warnings: [...warnings], verification: 'Both visible scroll boundaries settled. The platform may still withhold history or attachments.' },
      assets: [...assets.values()].map(({ id, kind, name, blob, error, previewPages, previewError }) => ({ id, kind, name, size: blob?.size || 0, mime: blob?.type || '', error,previewError,
        ...(previewPages?{previewPages:previewPages.map(p=>({width:p.width,height:p.height,size:p.blob.size}))}:{}) }))
    };
    handle.summary = summary;
    progress('Conversation loaded', { done: true });
    return options.stream ? { ...summary, token } : { ...summary, messages: handle.messages };
  } catch (e) { handle.dispose(); throw e; }
  finally {
    observer?.disconnect();
    for (const restore of expanded.reverse()) try { restore(); } catch {}
    if (scroller) { scroller.style.scrollBehavior = 'auto'; scroller.scrollTop = oldTop; scroller.style.scrollBehavior = oldBehavior; }
    if(!options.stream)globalThis.chrome?.storage?.onChanged.removeListener(onPermissions);
    if (!options.stream && !disposed) handle.dispose();
  }
}
export function touchCapture(token) {
  const job = globalThis.__personalExportCapture;
  if (job?.token === token) job.lastAccess = Date.now();
}
export function readCaptureBatch(token, offset) {
  const job = globalThis.__personalExportCapture;
  if (!job || job.token !== token || job.controller.signal.aborted) throw new Error('Capture session expired. Retry.');
  job.lastAccess = Date.now();
  const messages = []; let chars = 0;
  for (let i = offset; i < job.messages.length; i++) {
    const message = job.messages[i], size = JSON.stringify(message).length;
    if (chars + size > 1000000 && messages.length) break;
    if (size > 8 * 1024 * 1024) throw new Error('One message exceeds the safe transfer size. Nothing was truncated.');
    messages.push(message); chars += size;
  }
  return { messages, next: offset + messages.length, done: offset + messages.length >= job.messages.length };
}
export async function readCaptureAsset(token, id, offset) {
  const job = globalThis.__personalExportCapture;
  if (!job || job.token !== token || job.controller.signal.aborted) throw new Error('Capture session expired. Retry.');
  job.lastAccess = Date.now();
  const asset = job.assets.get(id);
  if (!asset?.blob) throw new Error(asset?.error || 'Attachment is unavailable.');
  const part = new Uint8Array(await asset.blob.slice(offset, offset + 256 * 1024).arrayBuffer());
  let binary = '';
  for (let i = 0; i < part.length; i += 8192) binary += String.fromCharCode(...part.subarray(i, i + 8192));
  const done = offset + part.length >= asset.blob.size;
  if (done) { asset.blob = undefined; }
  return { base64: btoa(binary), next: offset + part.length, done };
}
export function cancelCapture(token) {
  const job = globalThis.__personalExportCapture;
  if (job && (!token || job.token === token)) job.dispose();
}
export async function readCapturePreview(token,id,index,offset) {
  const job=globalThis.__personalExportCapture;
  if(!job||job.token!==token||job.controller.signal.aborted)throw new Error('Slide capture session expired.');
  job.lastAccess=Date.now();const page=job.assets.get(id)?.previewPages?.[index];
  if(!page?.blob||!Number.isInteger(offset)||offset<0)throw new Error('Slide preview bytes unavailable.');
  const bytes=new Uint8Array(await page.blob.slice(offset,offset+256*1024).arrayBuffer());let binary='';
  for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));
  const done=offset+bytes.length>=page.blob.size;if(done)page.blob=undefined;
  return {base64:btoa(binary),next:offset+bytes.length,done};
}
