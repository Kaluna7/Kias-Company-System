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

function putFileToPresignedUrl(uploadUrl, file, contentType, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.timeout = 0;
    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      } else if (file.size > 0) {
        onProgress(event.loaded, file.size);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Upload ke storage gagal (HTTP ${xhr.status}). Periksa CORS MinIO (port 9000) dan firewall.`,
        ),
      );
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Koneksi ke MinIO gagal. Pastikan port 9000 terbuka dan CORS MinIO dikonfigurasi.",
        ),
      );
    xhr.ontimeout = () => reject(new Error("Upload timeout — coba lagi."));
    xhr.onabort = () => reject(new Error("Upload dibatalkan."));

    if (signal) {
      if (signal.aborted) xhr.abort();
      else signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

/**
 * Upload one evidence file: MinIO pre-signed (preferred) or legacy multipart POST.
 */
export async function uploadEvidenceFile(
  { evidenceApiSlug, departmentLabel, effectiveYear, row, file },
  onProgress,
  options = {},
) {
  const signal = options.signal;
  const safeName = file.name || "upload.dat";
  const payload = {
    department: departmentLabel,
    ap_code: row.ap_code ?? "",
    year: String(effectiveYear),
    fileName: safeName,
    contentType: file.type || undefined,
    fileSize: file.size || 0,
  };
  if (row.ap_id != null && row.ap_id !== "" && !Number.isNaN(Number(row.ap_id))) {
    payload.ap_id = row.ap_id;
  }

  const presignRes = await fetch("/api/evidence/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  let presign = {};
  try {
    presign = await presignRes.json();
  } catch {
    throw new Error("Respons presign tidak valid.");
  }

  if (!presignRes.ok) {
    const err = new Error(
      presign.error ||
        (presignRes.status === 503
          ? "Storage MinIO sedang mati / tidak dapat dihubungi. File TIDAK tersimpan. Hubungi admin untuk menyalakan MinIO, lalu upload ulang."
          : `Presign gagal (HTTP ${presignRes.status})`),
    );
    err.code = presign.code;
    throw err;
  }

  if (presign.uploadMode === "minio" && presign.uploadUrl) {
    try {
      await putFileToPresignedUrl(
        presign.uploadUrl,
        file,
        presign.contentType || file.type,
        onProgress,
        signal,
      );
    } catch (putErr) {
      const msg = String(putErr?.message || "");
      if (/minio|cors|koneksi|storage|9000/i.test(msg)) {
        const err = new Error(
          "Upload ke MinIO gagal. File TIDAK tersimpan. Pastikan MinIO hidup (port 9000) lalu coba lagi.",
        );
        err.code = "MINIO_DOWN";
        err.cause = putErr;
        throw err;
      }
      throw putErr;
    }

    const completeRes = await fetch("/api/evidence/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        objectKey: presign.objectKey,
        fileName: presign.fileName || safeName,
      }),
      signal,
    });

    let complete = {};
    try {
      complete = await completeRes.json();
    } catch {
      throw new Error("Respons complete tidak valid.");
    }

    if (!completeRes.ok || complete.success === false) {
      const err = new Error(
        complete.error ||
          (completeRes.status === 503
            ? "Storage MinIO sedang mati / tidak dapat dihubungi. File TIDAK tersimpan."
            : `Complete gagal (HTTP ${completeRes.status})`),
      );
      err.code = complete.code;
      throw err;
    }

    return {
      success: true,
      fileUrl: complete.fileUrl,
      fileName: complete.fileName || safeName,
    };
  }

  return uploadEvidenceWithProgress(
    getEvidenceApiUrl(evidenceApiSlug),
    (() => {
      const formData = new FormData();
      formData.append("file", file, safeName);
      formData.append("original_name", safeName);
      if (payload.ap_id != null) formData.append("ap_id", String(payload.ap_id));
      formData.append("ap_code", payload.ap_code);
      formData.append("department", departmentLabel);
      formData.append("year", payload.year);
      return formData;
    })(),
    onProgress,
    { fileSize: file.size || 0, signal },
  );
}

/**
 * Legacy: POST evidence file with XMLHttpRequest upload progress.
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

export const EVIDENCE_LARGE_UPLOAD_BYTES = 0;
