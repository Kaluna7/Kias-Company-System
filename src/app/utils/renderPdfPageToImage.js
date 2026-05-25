"use client";

import { ensurePdfWorker } from "@/app/utils/pdfjsClient";

/**
 * Render satu halaman PDF ke PNG base64.
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} pageNum 1-based
 * @param {{ pdf?: object }} [opts] — instance PDF terbuka (opsional, hindari buka ulang)
 */
export async function renderPdfPageToPngBase64(arrayBuffer, pageNum, opts = {}) {
  const pdfjsLib = await ensurePdfWorker();

  let pdf = opts.pdf;
  let ownPdf = false;
  if (!pdf) {
    const data = new Uint8Array(arrayBuffer);
    pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
    ownPdf = true;
  }

  const page = await pdf.getPage(pageNum);
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");

  await page.render({ canvasContext: ctx, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/png", 0.92);
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

  if (typeof page.cleanup === "function") page.cleanup();
  if (ownPdf && typeof pdf.destroy === "function") pdf.destroy();

  return base64;
}

export {
  splitPagesFromFullText,
  getPagesNeedingOcrFromFullText,
} from "@/app/utils/sopProcedurePages";
