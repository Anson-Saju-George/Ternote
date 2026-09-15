(() => {
  if (globalThis.__personalExportButton?.version === 2) return;
  globalThis.__personalExportButton?.dispose?.();
  document.querySelectorAll('[data-personal-exporter="button"]').forEach(node => node.remove());
  const ids = { 'chatgpt.com': 'chatgpt', 'claude.ai': 'claude', 'gemini.google.com': 'gemini' };
  const platform = ids[location.hostname];
  if (!platform) return;
  globalThis.__personalExportButton = {version:2,dispose};
  let host;
  function dispose() {
    host?.remove(); host = undefined;
    chrome.storage.onChanged.removeListener(onChange);
    globalThis.__personalExportButton = false;
  }
  function render(settings) {
    if (settings.enabled?.[platform] === false) return dispose();
    if (settings.preferences?.showButton === false) { host?.remove(); host = undefined; return; }
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.dataset.personalExporter = 'button';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{all:initial;position:fixed;right:18px;bottom:90px;z-index:2147483000}button{font:650 13px system-ui;color:#fff;background:#204a37;border:1px solid #5e8e80;border-radius:5px;padding:9px 15px;box-shadow:0 3px 12px #0002;cursor:pointer}button:focus-visible{outline:3px solid #e3af46;outline-offset:3px}';
    const button = document.createElement('button');
    button.textContent = 'Export';
    button.title = 'Open Personal AI Chat Exporter';
    button.addEventListener('click', async () => {
      try { const result = await chrome.runtime.sendMessage({ type: 'open-export' }); if (!result?.ok) dispose(); }
      catch { dispose(); }
    });
    shadow.append(style, button); document.documentElement.append(host);
  }
  async function refresh() {
    try { render(await chrome.storage.local.get(['enabled', 'preferences'])); } catch { dispose(); }
  }
  function onChange(changes, area) { if (area === 'local' && (changes.enabled || changes.preferences)) void refresh(); }
  chrome.storage.onChanged.addListener(onChange);
  void refresh();
})();
