import '../vendor/pdfmake/pdfmake.min.js';
import '../vendor/pdfmake/vfs_fonts.js';
import '../vendor/pdfmake/extra-fonts.js';
import '../vendor/pdfmake/Courier.js';
import { pdfDefinition } from './pdf-layout.js';
const pdfMake = globalThis.pdfMake;
pdfMake.addFonts({
  Emoji: { normal: 'NotoEmoji.ttf', bold: 'NotoEmoji.ttf', italics: 'NotoEmoji.ttf', bolditalics: 'NotoEmoji.ttf' },
  Tamil: { normal: 'NotoSansTamil-Regular.ttf', bold: 'NotoSansTamil-Bold.ttf', italics: 'NotoSansTamil-Regular.ttf', bolditalics: 'NotoSansTamil-Bold.ttf' },
  Devanagari: { normal: 'NotoSansDevanagari-Regular.ttf', bold: 'NotoSansDevanagari-Bold.ttf', italics: 'NotoSansDevanagari-Regular.ttf', bolditalics: 'NotoSansDevanagari-Bold.ttf' },
  Malayalam: { normal: 'NotoSansMalayalam-Regular.ttf', bold: 'NotoSansMalayalam-Bold.ttf', italics: 'NotoSansMalayalam-Regular.ttf', bolditalics: 'NotoSansMalayalam-Bold.ttf' }
});
// Courier is bundled as a standard PDF font for legible, aligned code.
pdfMake.addFonts({ Mono: { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' } });
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ progress: { stage: 'Typesetting the PDF' } });
    const pdf = pdfMake.createPdf(pdfDefinition(data.conversation, data.theme));
    const buffer = await pdf.getBuffer();
    const bytes = new Uint8Array(buffer);
    self.postMessage({ result: bytes.buffer }, [bytes.buffer]);
  } catch (error) { self.postMessage({ error: error.message || 'PDF generation failed.' }); }
};
