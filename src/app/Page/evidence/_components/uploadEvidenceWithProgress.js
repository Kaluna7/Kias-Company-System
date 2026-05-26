/** Build evidence API URL; slug is a raw path segment (e.g. "g&a", not percent-encoded). */
export function getEvidenceApiUrl(slug, searchParams) {
  const path = `/api/evidence/${slug}`;
  if (typeof window !== "undefined") {
    const url = new URL(path, window.location.origin);
    if (searchParams) {
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.set(key, value);
      }
    }
    return url.pathname + url.search;
  }
  const qs = searchParams?.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * POST evidence file with XMLHttpRequest upload progress (no client timeout for large files).
 * @param {string} url
 * @param {FormData} formData
 * @param {(loaded: number, total: number) => void} [onProgress]
 * @param {{ fileSize?: number, signal?: AbortSignal }} [options]
 */
export function uploadEvidenceWithProgress(url, formData, onProgress, options = {}) {
  const expectedSize = options.fileSize || 0;
  const signal = options.signal;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 0;

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      } else if (expectedSize > 0) {
        onProgress(event.loaded, expectedSize);
      } else {
        onProgress(event.loaded, event.loaded || 1);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 0) {
        reject(new Error("Koneksi terputus. Upload dibatalkan atau server tidak merespons."));
        return;
      }

      let result = {};
      try {
        result = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        reject(new Error("Respons server tidak valid."));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (result.success === false) {
          reject(new Error(result.error || "Upload gagal"));
          return;
        }
        resolve(result);
      } else {
        const fallback =
          xhr.responseText && xhr.responseText.length < 200 && !xhr.responseText.includes("<")
            ? xhr.responseText.trim()
            : "";
        reject(
          new Error(
            result.error ||
              fallback ||
              `Upload gagal (HTTP ${xhr.status}). Periksa ukuran file (maks. 8 GB) dan restart server setelah deploy.`,
          ),
        );
      }
    };

    xhr.onerror = () => reject(new Error("Koneksi jaringan gagal saat upload."));
    xhr.ontimeout = () => reject(new Error("Upload timeout — coba lagi atau periksa koneksi."));
    xhr.onabort = () => reject(new Error("Upload dibatalkan."));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
      } else {
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
    }

    xhr.send(formData);
  });
}

/** Show full-screen progress overlay for any upload. */
export const EVIDENCE_LARGE_UPLOAD_BYTES = 0;
