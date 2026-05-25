import { isVisionOnlyExtractMode } from "@/app/lib/sopExtractMode";
import { processSopPdfVisionOnly } from "@/app/utils/processSopPdfVisionOnly";
import { extractFullTextFromPdfArrayBuffer } from "@/app/utils/extractPdfFullText";

/**
 * @param {File} file
 * @param {{ onProgress?: (p: { progress: number, statusLabel: string }) => void }} opts
 */
export async function processSopPdfWithProgress(file, { onProgress } = {}) {
  if (isVisionOnlyExtractMode()) {
    return processSopPdfVisionOnly(file, { onProgress });
  }
  const report = (progress, statusLabel) => onProgress?.({ progress, statusLabel });

  report(2, "Memproses dokumen...");
  report(5, "Membaca file PDF...");
  const arrayBuffer = await file.arrayBuffer();

  report(18, "Mengekstrak teks dari PDF...");
  const clientText = await extractFullTextFromPdfArrayBuffer(arrayBuffer);

  report(30, "Memeriksa halaman yang perlu OCR...");
  const { getPagesNeedingOcrFromFullText, renderPdfPageToPngBase64 } = await import(
    "@/app/utils/renderPdfPageToImage"
  );

  const needOcr = getPagesNeedingOcrFromFullText(clientText || "");
  const ocrPages = [];
  const ocrTotal = Math.min(needOcr.length, 20);

  for (let i = 0; i < ocrTotal; i++) {
    const p = needOcr[i];
    const pct = 30 + Math.round((30 * (i + 1)) / Math.max(1, ocrTotal));
    report(pct, ocrTotal > 0 ? `OCR halaman ${p.page} dari ${ocrTotal}...` : "Menyiapkan analisis AI...");
    try {
      const imageBase64 = await renderPdfPageToPngBase64(arrayBuffer, p.page);
      ocrPages.push({ page: p.page, imageBase64, mime: "image/png" });
    } catch (err) {
      console.warn("[SOP OCR] render page failed", p.page, err);
    }
  }

  if (ocrTotal === 0) {
    report(55, "Teks PDF siap — mengirim ke AI...");
  } else {
    report(62, "Mengirim ke server untuk analisis struktur SOP...");
  }

  const form = new FormData();
  form.append("pdf", file, file.name || "document.pdf");
  form.append("debug", "true");
  if (ocrPages.length > 0) {
    form.append("ocrPages", JSON.stringify(ocrPages));
  }

  const res = await fetch("/api/Ai/extract-steps", { method: "POST", body: form });
  report(85, "Memproses respons AI...");
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    report(100, "Selesai dengan peringatan");
    return {
      success: false,
      error: json.error || `AI API error (${res.status})`,
      ...json,
      clientText,
      arrayBuffer,
    };
  }

  report(100, "Selesai");
  return { ...json, clientText, arrayBuffer };
}
