import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
async function check(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await check(path);else if(/\.(mjs|js)$/.test(e.name)){const r=spawnSync(process.execPath,['--check',path],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);}}}
await check(join(root,'src'));await check(join(root,'scripts'));await check(join(root,'tests'));
const m=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
assert.equal(m.manifest_version,3);
assert.deepEqual(m.permissions,['storage','scripting','activeTab']);
assert.equal(m.optional_host_permissions.length,3);
assert(!JSON.stringify(m).includes('<all_urls>'));
assert(!m.content_scripts,'Sites must be registered only after permission');
console.log('JavaScript syntax and permission checks passed.');
