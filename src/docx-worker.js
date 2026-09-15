import '../vendor/mammoth/mammoth.browser.min.js';
// Reject oversized ZIP expansion before the document parser allocates it.
function validateZip(buffer) {
  const view = new DataView(buffer); let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('Invalid DOCX container.');
  const count = view.getUint16(end + 10, true), start = view.getUint32(end + 16, true);
  if (count === 65535 || start === 0xffffffff || count > 10000) throw new Error('This DOCX container is too complex to parse safely.');
  let at = start, expanded = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > buffer.byteLength || view.getUint32(at, true) !== 0x02014b50) throw new Error('Invalid DOCX directory.');
    expanded += view.getUint32(at + 24, true);
    if (expanded > 128 * 1024 * 1024) throw new Error('DOCX expands beyond the safe memory budget (128 MB).');
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
}
self.onmessage = async ({ data }) => {
  try {
    validateZip(data.buffer);
    const result = await globalThis.mammoth.convertToHtml({ arrayBuffer: data.buffer }, {
      externalFileAccess: false, includeEmbeddedStyleMap: false,
      convertImage: globalThis.mammoth.images.imgElement(async image => {
        if (!/^image\/(png|jpeg|gif|webp)$/.test(image.contentType)) return { alt: 'Unsupported document image (not embedded)' };
        return { src: 'data:' + image.contentType + ';base64,' + await image.readAsBase64String() };
      })
    });
    self.postMessage({ result: { html: result.value, warnings: result.messages.map(m => m.message) } });
  } catch (error) { self.postMessage({ error: error.message || 'Unable to parse this DOCX.' }); }
};
