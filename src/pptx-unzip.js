import { verifyOfficeFile } from './office-file.js';

// Native bounded decompression: no remote code, ZIP library or executable Office content.
export async function unpackPresentation(buffer, signal) {
  const {files} = verifyOfficeFile(buffer, 'pptx', true);
  const parts = []; let total = 0;
  for (const entry of files) {
    signal?.throwIfAborted();
    if (!entry.name.startsWith('ppt/') || !/\.(xml|rels|png|jpe?g|gif|webp)$/i.test(entry.name)) continue;
    const xml = /\.(xml|rels)$/i.test(entry.name);
    const limit = xml ? 8*1024*1024 : 32*1024*1024;
    if (entry.uncompressed > limit) throw new Error('A presentation part exceeds the safe size budget.');
    const blob = new Blob([new Uint8Array(buffer, entry.offset, entry.compressed)]);
    const stream = entry.method === 8 ? blob.stream().pipeThrough(new DecompressionStream('deflate-raw')) : blob.stream();
    const reader = stream.getReader(), chunks = []; let size=0, crc=0xffffffff;
    try {
      while (true) {
        signal?.throwIfAborted();
        const {value,done} = await reader.read(); if (done) break;
        size += value.length; total += value.length;
        if (size > entry.uncompressed || size > limit || total > 128*1024*1024) throw new Error('Presentation expansion exceeded its declared size or memory budget.');
        for (const byte of value) { crc ^= byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
    if (size !== entry.uncompressed || ((crc^0xffffffff)>>>0) !== entry.crc) throw new Error('Presentation part failed its size or checksum check.');
    parts.push({name:entry.name, buffer:await new Blob(chunks).arrayBuffer()});
  }
  return parts;
}
