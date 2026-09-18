// MAIN-world, single-action adapter. No app-state access, tokens, endpoint guessing or network hooks.
export async function resolveNativeFile(marker, name, expectedUrl) {
  const error = message => ({error:message});
  if (location.origin !== 'https://chatgpt.com' || location.href !== expectedUrl) return error('Conversation changed. Retry.');
  if (typeof marker !== 'string' || marker.length > 160 || typeof name !== 'string' || name.length > 200) return error('Invalid file request.');
  const card = [...document.querySelectorAll('[data-ternote-file]')].find(e => e.getAttribute('data-ternote-file') === marker);
  const normalized = value => String(value || '').replace(/\s+/g,' ').trim();
  if (!card?.matches('button,[role="button"]') || !card.closest('[data-message-author-role]') || !normalized(card.textContent).includes(name) || card.disabled) return error('The file card is no longer available.');
  if (globalThis.__ternoteNativeFileBusy) return error('Another file viewer request is active. Retry.');
  const lock = {}; globalThis.__ternoteNativeFileBusy = lock;
  const previousOpen = window.open, previousClick = HTMLAnchorElement.prototype.click;
  const previousClose = new Set(document.querySelectorAll('button[aria-label="Close"]'));
  const started = Date.now(); let stopped = false, resolved, close;
  const valid = () => !stopped && Date.now() - started < 12000 && location.href === expectedUrl && card.isConnected && card.getAttribute('data-ternote-file') === marker;
  const pause = () => new Promise(r => setTimeout(r,100));
  function accept(value) {
    if (!valid()) return false;
    try {
      const url = new URL(value,location.href);
      if (url.origin !== location.origin || url.protocol !== 'https:' || url.username || url.password) return false;
      resolved = url.href; return true;
    } catch { return false; }
  }
  const opened = function(value,...args) { if (accept(value)) return null; return previousOpen.call(this,value,...args); };
  const clicked = function(...args) { if ((!this.download || normalized(this.download) === name) && accept(this.href)) return; return previousClick.apply(this,args); };
  function restore() {
    stopped = true;
    if (window.open === opened) window.open = previousOpen;
    if (HTMLAnchorElement.prototype.click === clicked) HTMLAnchorElement.prototype.click = previousClick;
    if (globalThis.__ternoteNativeFileBusy === lock) delete globalThis.__ternoteNativeFileBusy;
  }
  const watchdog = setTimeout(restore,12000);
  try {
    card.click();
    let download;
    while (valid() && Date.now()-started < 7000) {
      const matches = [...document.querySelectorAll('button[aria-label="Download file"],button[aria-label="Download"]')].filter(button => {
        if (button.disabled || !button.getClientRects().length) return false;
        // Require a local viewer ancestor that names this file and contains no chat messages.
        for (let root=button.parentElement,depth=0; root && root!==document.body && depth<6; root=root.parentElement,depth++) {
          if (root.querySelector('[data-message-author-role]')) break;
          const titles = [...root.querySelectorAll('h1,h2,h3,[title],[data-testid="file-name"],span,p')];
          if (titles.some(e => normalized(e.getAttribute('title') || e.textContent) === name)) return true;
        }
        return false;
      });
      if (matches.length===1) { download=matches[0]; break; }
      await pause();
    }
    close = [...document.querySelectorAll('button[aria-label="Close"]')].find(e=>!previousClose.has(e) && e.getClientRects().length);
    if (!download || !valid()) return error('No unambiguous file viewer download was found. Open the file in ChatGPT and retry.');
    // Hooks exist only during this matching viewer's download action, then are restored.
    window.open=opened; HTMLAnchorElement.prototype.click=clicked;
    download.click();
    while (!resolved && valid()) await pause();
    return resolved && valid() ? {url:resolved} : error('The viewer did not expose a supported download URL before the timeout.');
  } catch { return error('The native file viewer could not be read.'); }
  finally {
    clearTimeout(watchdog); restore();
    if (close?.isConnected && location.href===expectedUrl) try { close.click(); } catch {}
  }
}
