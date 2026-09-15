// Independently authored candidate adapters. Live-site validation is pending.
export const PLATFORMS = [
  { id: 'chatgpt', name: 'ChatGPT', host: 'chatgpt.com', origin: 'https://chatgpt.com/*',
    selectors: ['[data-message-author-role]'],
    user: ['[data-message-author-role="user"]'], assistant: ['[data-message-author-role="assistant"]'] },
  { id: 'claude', name: 'Claude', host: 'claude.ai', origin: 'https://claude.ai/*',
    selectors: ['[data-message-author-role]', '[data-testid="user-message"], [data-testid="assistant-message"]'],
    user: ['[data-message-author-role="user"]', '[data-testid="user-message"]'],
    assistant: ['[data-message-author-role="assistant"]', '[data-testid="assistant-message"]'] },
  { id: 'gemini', name: 'Gemini', host: 'gemini.google.com', origin: 'https://gemini.google.com/*',
    selectors: ['user-query, model-response'],
    user: ['user-query'], assistant: ['model-response'] }
];
export function platformFor(url) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' ? PLATFORMS.find(p => p.host === parsed.hostname) : undefined; }
  catch { return undefined; }
}
export const DEFAULTS = { format: 'markdown', theme: 'light', metadata: true, images: true, showButton: true };
export function preferences(value = {}) {
  return {
    format: ['markdown','html','text','json','csv','pdf'].includes(value.format) ? value.format : DEFAULTS.format,
    theme: value.theme === 'dark' ? 'dark' : 'light',
    metadata: typeof value.metadata === 'boolean' ? value.metadata : true,
    images: typeof value.images === 'boolean' ? value.images : true,
    showButton: typeof value.showButton === 'boolean' ? value.showButton : true
  };
}
