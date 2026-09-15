// Unreleased draft. Lifecycle integration and tests are required before shipping.
import {CACHE_VERSION,CACHE_TTL_MS,CACHE_MAX_BYTES,estimateBytes,evictionKeys} from './cache-policy.js';
const DB_NAME='personal-export-temporary-cache';
let opening;
function open() {
  return opening ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('meta',{keyPath:'key'});request.result.createObjectStore('payload',{keyPath:'key'});};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=undefined;};resolve(db);};
    request.onerror=()=>{opening=undefined;reject(request.error);};
  });
}
function requestValue(request) { return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}); }
function finished(tx) { return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Cache transaction aborted.'));tx.onerror=()=>{};}); }
export async function cacheMetadata() {
  const db=await open(),tx=db.transaction('meta','readonly'),done=finished(tx);
  const rows=await requestValue(tx.objectStore('meta').getAll());await done;return rows;
}
export async function scheduleCacheCleanup() {
  if(!globalThis.chrome?.alarms)return;
  const entries=await cacheMetadata();
  if(entries.length)await chrome.alarms.create('export-cache-expiry',{when:Math.min(...entries.map(e=>e.expiresAt))});
  else await chrome.alarms.clear('export-cache-expiry');
}
export async function clearCache(key) {
  const db=await open(),tx=db.transaction(['meta','payload'],'readwrite'),done=finished(tx);
  for(const name of ['meta','payload'])key?tx.objectStore(name).delete(key):tx.objectStore(name).clear();
  await done;await scheduleCacheCleanup();
}
export async function purgeExpired(now=Date.now()) {
  const db=await open(),tx=db.transaction(['meta','payload'],'readwrite'),done=finished(tx);
  const req=tx.objectStore('meta').openCursor();
  req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;if(cursor.value.expiresAt<=now||cursor.value.version!==CACHE_VERSION){tx.objectStore('payload').delete(cursor.key);cursor.delete();}cursor.continue();};
  await done;await scheduleCacheCleanup();
}
export async function readCache(key) {
  const db=await open(),tx=db.transaction(['meta','payload'],'readwrite'),done=finished(tx);
  let payload,meta;
  const req=tx.objectStore('meta').get(key);
  req.onsuccess=()=>{
    meta=req.result;
    if(!meta)return;
    if(meta.version!==CACHE_VERSION||meta.expiresAt<=Date.now()){tx.objectStore('meta').delete(key);tx.objectStore('payload').delete(key);return;}
    meta.lastUsed=Date.now();tx.objectStore('meta').put(meta);
    const value=tx.objectStore('payload').get(key);value.onsuccess=()=>{payload=value.result?.value;};
  };
  await done;
  return payload?{...payload,cacheExpiresAt:meta.expiresAt}:null;
}
export async function writeCache(key,value) {
  const bytes=estimateBytes(value);
  if(bytes>CACHE_MAX_BYTES)return {stored:false,reason:'This snapshot exceeds the temporary cache budget; it remains available in this view.'};
  const now=Date.now(),meta={key,version:CACHE_VERSION,bytes,lastUsed:now,createdAt:now,expiresAt:now+CACHE_TTL_MS};
  const db=await open(),tx=db.transaction(['meta','payload'],'readwrite'),done=finished(tx);
  const req=tx.objectStore('meta').getAll();
  req.onsuccess=()=>{
    for(const victim of evictionKeys(req.result,meta,now)){tx.objectStore('meta').delete(victim);tx.objectStore('payload').delete(victim);}
    tx.objectStore('meta').put(meta);tx.objectStore('payload').put({key,value});
  };
  await done;await scheduleCacheCleanup();return {stored:true,expiresAt:meta.expiresAt};
}
