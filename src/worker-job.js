export function workerJob(path, payload, { signal, onProgress = () => {}, timeout = 0 } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(path, import.meta.url), { type: 'module' });
    let timer;
    function finish(error, value) {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate();
      error ? reject(error) : resolve(value);
    }
    const abort = () => finish(new DOMException('Export cancelled.', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.progress) onProgress(data.progress);
      else if (data.error) finish(new Error(data.error));
      else finish(null, data.result);
    };
    worker.onerror = event => finish(new Error('The local document worker failed: ' + (event.message || 'unknown worker error')));
    if (timeout) timer = setTimeout(() => finish(new Error('This attachment took too long to parse safely.')), timeout);
    worker.postMessage(payload);
  });
}
