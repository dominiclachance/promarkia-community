const apiBase = (import.meta.env.VITE_LOCAL_API_BASE || '/api').replace(/\/$/, '');

export const getStorage = () => ({ mode: 'local' });
export const ref = (_storage, path) => ({ path });
export const deleteObject = async () => {};
export const getDownloadURL = async (reference) => reference.downloadURL || `/files/${reference.path}`;
export function uploadBytesResumable(reference, file) {
  const listeners = { progress: [], error: [], complete: [] };
  const task = {
    snapshot: { ref: reference, bytesTransferred: 0, totalBytes: file.size },
    on(_event, progress, error, complete) {
      if (progress) listeners.progress.push(progress);
      if (error) listeners.error.push(error);
      if (complete) listeners.complete.push(complete);
    },
  };
  queueMicrotask(async () => {
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`${apiBase}/local/artifacts/upload`, { method: 'POST', body });
      if (!response.ok) throw new Error(await response.text());
      const artifact = await response.json();
      reference.downloadURL = `/files/${artifact.relative_path.replace(/^artifacts[\\/]/, '../artifacts/')}`;
      task.snapshot = { ref: reference, bytesTransferred: file.size, totalBytes: file.size };
      listeners.progress.forEach((listener) => listener(task.snapshot));
      listeners.complete.forEach((listener) => listener());
    } catch (error) {
      listeners.error.forEach((listener) => listener(error));
    }
  });
  return task;
}
