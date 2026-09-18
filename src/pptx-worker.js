import { unpackPresentation } from './pptx-unzip.js';
self.onmessage = async ({data}) => {
  try {
    const parts = await unpackPresentation(data.buffer);
    self.postMessage({result:parts}, parts.map(part=>part.buffer));
  } catch (error) { self.postMessage({error:error.message || 'Unable to unpack this presentation.'}); }
};
