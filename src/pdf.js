import { workerJob } from './worker-job.js';
export async function createPdf(conversation, theme, options = {}) {
  const buffer = await workerJob('./pdf-worker.js', { conversation, theme }, options);
  const bytes = new Uint8Array(buffer);
  if (new TextDecoder().decode(bytes.subarray(0,5)) !== '%PDF-') throw new Error('PDF generation returned an invalid document.');
  return new Blob([bytes], { type: 'application/pdf' });
}
