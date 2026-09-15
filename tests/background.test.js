import {test} from 'node:test';
import assert from 'node:assert/strict';
test('optional permissions register only enabled platforms and revoke cleanly',async()=>{
  const granted=new Set(),registered=new Map(),storage={};let onMessage,onAdded,onRemoved;
  const old=globalThis.chrome;
  globalThis.chrome={
    runtime:{id:'test',onInstalled:{addListener(){}},onStartup:{addListener(){}},onMessage:{addListener(fn){onMessage=fn;}}},
    permissions:{contains:async({origins})=>origins.every(o=>granted.has(o)),onAdded:{addListener(fn){onAdded=fn;}},onRemoved:{addListener(fn){onRemoved=fn;}}},
    scripting:{getRegisteredContentScripts:async({ids})=>ids.flatMap(id=>registered.has(id)?[registered.get(id)]:[]),registerContentScripts:async entries=>entries.forEach(e=>registered.set(e.id,e)),unregisterContentScripts:async({ids})=>ids.forEach(id=>registered.delete(id))},
    storage:{local:{set:async values=>Object.assign(storage,values)}}
  };
  try{
    await import('../src/background.js?test=permissions');
    const reconcile=()=>new Promise(resolve=>onMessage({type:'reconcile'},{id:'test'},resolve));
    await reconcile();assert.equal(registered.size,0);
    granted.add('https://chatgpt.com/*');onAdded();await reconcile();
    assert.equal(registered.size,1);assert(registered.has('export-chatgpt'));assert.equal(storage.enabled.chatgpt,true);assert.equal(storage.enabled.claude,false);
    granted.clear();onRemoved();await reconcile();assert.equal(registered.size,0);assert.equal(storage.enabled.chatgpt,false);
    let called=false;onMessage({type:'reconcile'},{id:'foreign-extension'},()=>{called=true;});assert.equal(called,false);
  }finally{globalThis.chrome=old;}
});
