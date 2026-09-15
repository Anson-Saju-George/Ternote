import { PLATFORMS, platformFor } from './platforms.js';
let queue = Promise.resolve();
function reconcile() {
  queue = queue.catch(() => {}).then(async () => {
    const enabled = {};
    for (const p of PLATFORMS) {
      enabled[p.id] = await chrome.permissions.contains({ origins: [p.origin] });
      const id = 'export-' + p.id;
      const present = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
      if (enabled[p.id] && !present.length) await chrome.scripting.registerContentScripts([{
        id, matches: [p.origin], js: ['src/button.js'], runAt: 'document_idle', persistAcrossSessions: true
      }]);
      if (!enabled[p.id] && present.length) await chrome.scripting.unregisterContentScripts({ ids: [id] });
    }
    await chrome.storage.local.set({ enabled });
  });
  return queue;
}
chrome.runtime.onInstalled.addListener(() => void reconcile());
chrome.runtime.onStartup.addListener(() => void reconcile());
chrome.permissions.onAdded.addListener(() => void reconcile());
chrome.permissions.onRemoved.addListener(() => void reconcile());
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'reconcile' && !sender.tab) {
    reconcile().then(() => reply({ ok: true }), () => reply({ ok: false }));
    return true;
  }
  if (message?.type === 'open-export' && sender.tab?.id && sender.frameId === 0) {
    const p = platformFor(sender.url);
    if (!p) return;
    chrome.permissions.contains({ origins: [p.origin] }).then(async granted => {
      if (!granted) return reply({ ok: false });
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/index.html') + '?tab=' + sender.tab.id });
      reply({ ok: true });
    }).catch(() => reply({ ok: false }));
    return true;
  }
});
