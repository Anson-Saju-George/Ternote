// Unreleased draft. Not imported by the extension.
export const CACHE_VERSION = 3;
export const CACHE_TTL_MS = 30 * 60 * 1000;
export const CACHE_MAX_BYTES = 128 * 1024 * 1024;
export const CACHE_MAX_ENTRIES = 4;
export function conversationKey(value) {
  try { const url = new URL(value); return /^https:$/.test(url.protocol) && ['chatgpt.com','claude.ai','gemini.google.com'].includes(url.hostname) ? url.origin + url.pathname.replace(/\/+$/,'') : null; } catch { return null; }
}
export function cacheDecision(previous, current, sourceIds = []) {
  if (!previous || !current || previous.url !== current.url || previous.documentId !== current.documentId ||
      !current.tailAnchored || current.streaming || current.olderChanged || !current.tail.length) return { mode: 'replace' };
  const equal = (a,b) => a?.hash === b?.hash && a?.id === b?.id;
  if (previous.tail.length === current.tail.length && previous.tail.every((item,i) => equal(item,current.tail[i])) && previous.renderedCount === current.renderedCount) return { mode: 'reuse' };
  const known = new Set(sourceIds);
  for (let overlap = Math.min(previous.tail.length,current.tail.length)-1; overlap >= 1; overlap--) {
    const before = previous.tail.slice(-overlap), after = current.tail.slice(0,overlap);
    const added = current.tail.slice(overlap);
    if (before.every((item,i) => item.id && equal(item,after[i])) && added.length && added.every(item=>item.id&&!known.has(item.id)) &&
        current.renderedCount >= previous.renderedCount) return { mode:'append', sourceIds: added.map(item=>item.id) };
  }
  return { mode:'replace' };
}
export function estimateBytes(value) {
  if (value instanceof Blob) return value.size;
  if (typeof value === 'string') return value.length * 2;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  if (Array.isArray(value)) return value.reduce((sum,item)=>sum+estimateBytes(item)+16,32);
  if (value && typeof value === 'object') return Object.entries(value).reduce((sum,[key,item])=>sum+key.length*2+estimateBytes(item)+32,32);
  return 8;
}
export function evictionKeys(entries, incoming, now = Date.now()) {
  const victims = entries.filter(e=>e.expiresAt<=now||e.key===incoming?.key).map(e=>e.key);
  const remaining = entries.filter(e=>!victims.includes(e.key)).sort((a,b)=>a.lastUsed-b.lastUsed);
  let total = remaining.reduce((n,e)=>n+e.bytes,0)+(incoming?.bytes||0), count=remaining.length+(incoming?1:0);
  while (remaining.length && (total>CACHE_MAX_BYTES||count>CACHE_MAX_ENTRIES)) { const e=remaining.shift();victims.push(e.key);total-=e.bytes;count--; }
  return victims;
}
