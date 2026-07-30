import { buildEvidenceDownloadHref } from "@/lib/evidenceFileUrl";

/**
 * Download an evidence attachment via /api/evidence/file with progress callbacks.
 * @param {string} fileUrl
 * @param {string} [fileName]
 * @param {(loaded: number, total: number) => void} [onProgress]
 * @param {{ signal?: AbortSignal }} [options]
 */
export function downloadEvidenceWithProgress(fileUrl, fileName, onProgress, options = {}) {
  const href = buildEvidenceDownloadHref(fileUrl, fileName);
  if (!href) {
    return Promise.reject(new Error("URL file tidak valid."));
  }

  const signal = options.signal;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", href);
    xhr.responseType = "blob";
    xhr.withCredentials = true;
    xhr.timeout = 0;

    xhr.onprogress = (event) => {
      if (!onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded, event.total);
      } else if (event.loaded > 0) {
        onProgress(event.loaded, Math.max(event.loaded, 1));
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `Download gagal (HTTP ${xhr.status})`;
        try {
          const text = xhr.responseText || "";
          if (text && text.trim().startsWith("{")) {
            const json = JSON.parse(text);
            if (json?.error) message = json.error;
          }
        } catch {
          // keep default
        }
        // When responseType is blob, try parse blob as JSON error
        if (xhr.response instanceof Blob && xhr.response.type?.includes("application/json")) {
          xhr.response
            .text()
            .then((t) => {
              try {
                const json = JSON.parse(t);
                reject(new Error(json?.error || message));
              } catch {
                reject(new Error(message));
              }
            })
            .catch(() => reject(new Error(message)));
          return;
        }
        reject(new Error(message));
        return;
      }

      const blob = xhr.response;
      if (!(blob instanceof Blob) || blob.size === 0) {
        reject(new Error("File kosong atau tidak ditemukan di server."));
        return;
      }

      if ((blob.type || "").includes("application/json")) {
        blob
          .text()
          .then((t) => {
            try {
              const json = JSON.parse(t);
              reject(new Error(json?.error || "Server mengembalikan error, bukan file."));
            } catch {
              reject(new Error("Server mengembalikan error, bukan file."));
            }
          })
          .catch(() => reject(new Error("Server mengembalikan error, bukan file.")));
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      resolve({ success: true, size: blob.size });
    };

    xhr.onerror = () => reject(new Error("Koneksi gagal saat download. Coba lagi."));
    xhr.ontimeout = () => reject(new Error("Download timeout — coba lagi."));
    xhr.onabort = () => reject(new Error("Download dibatalkan."));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send();
  });
}
