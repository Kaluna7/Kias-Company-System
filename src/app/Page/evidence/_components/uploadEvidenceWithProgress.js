/**
 * POST evidence file with XMLHttpRequest upload progress.
 * @param {string} url
 * @param {FormData} formData
 * @param {(loaded: number, total: number) => void} [onProgress]
 */
export function uploadEvidenceWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total);
      }
    };
    xhr.onload = () => {
      let result = {};
      try {
        result = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        reject(new Error("Invalid server response"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(result);
      } else {
        reject(new Error(result.error || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(formData);
  });
}

/** Bytes threshold: show full-screen progress overlay (large upload). */
export const EVIDENCE_LARGE_UPLOAD_BYTES = 512 * 1024;
