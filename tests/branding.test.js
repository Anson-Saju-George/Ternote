import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Ternote identity is consistent across published metadata and UI', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  const pkg = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(manifest.name, 'Ternote');
  assert.equal(manifest.homepage_url, 'https://github.com/Anson-Saju-George/Ternote');
  assert.equal(pkg.name, 'ternote');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
  const ui = await read('src/ui/index.html');
  assert.match(ui, /<title>Ternote<\/title>/);
  assert.match(ui, /class="brand">Ternote<span>/);
  assert.match(await read('src/pdf-layout.js'), /creator: 'Ternote'/);
  for (const file of ['src/button.js', 'src/ui/index.html', 'src/pdf-layout.js', 'scripts/open-browser.mjs', 'scripts/package.mjs']) {
    assert.doesNotMatch(await read(file), /Personal AI Chat Exporter|Personal Exporter|personal-ai-chat-exporter/);
  }
});
