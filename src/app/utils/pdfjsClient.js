"use client";

/** Sesuaikan dengan pdfjs-dist di package.json */
const PDFJS_VERSION = "5.4.394";

const WORKER_CANDIDATES = [
  "/pdf.worker.min.mjs",
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
  `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
];

let configurePromise = null;

/**
 * Wajib dipanggil sebelum getDocument di browser (pdf.js v5 memerlukan workerSrc).
 * @returns {Promise<typeof import("pdfjs-dist/legacy/build/pdf")>}
 */
export async function ensurePdfWorker() {
  if (configurePromise) return configurePromise;

  configurePromise = (async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf");

    for (const src of WORKER_CANDIDATES) {
      try {
        const probe =
          src.startsWith("/") && typeof window !== "undefined"
            ? await fetch(src, { method: "HEAD" }).catch(() => null)
            : await fetch(src, { method: "HEAD", mode: "cors" }).catch(() => null);
        if (probe?.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = src;
          return pdfjs;
        }
      } catch {
        /* coba sumber berikutnya */
      }
    }

    pdfjs.GlobalWorkerOptions.workerSrc = WORKER_CANDIDATES[0];
    return pdfjs;
  })();

  return configurePromise;
}
