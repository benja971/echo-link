/** Upload a file via XMLHttpRequest so we can subscribe to upload progress
 *  events (the fetch API doesn't expose request-body progress yet without
 *  the still-flaky ReadableStream-as-body approach). */

export type UploadProgress = {
  loaded: number;
  total: number;
  pct: number;
};

export type UploadResult = {
  ok: boolean;
  status: number;
  body: unknown;
  /** Resolved JSON body if status is 2xx, otherwise the parsed error code. */
  errorCode?: string;
};

export function uploadFileWithProgress(
  file: File,
  endpoint: string,
  onProgress?: (p: UploadProgress) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          pct: Math.min(100, Math.round((e.loaded / e.total) * 100))
        });
      }
    };

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = xhr.responseText;
      }
      const ok = xhr.status >= 200 && xhr.status < 300;
      const errorCode = ok
        ? undefined
        : (typeof body === 'object' && body !== null && 'message' in body
            ? String((body as { message: unknown }).message)
            : `http ${xhr.status}`);
      resolve({ ok, status: xhr.status, body, errorCode });
    };

    xhr.onerror = () => reject(new Error('network error'));
    xhr.onabort = () => reject(new Error('aborted'));

    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}
