/**
 * Client: PDF → render tiap halaman ke PNG → API vision-only (tanpa parser teks).
 */
import { isVisionOnlyExtractMode } from "@/app/lib/sopExtractMode";
import { ensurePdfWorker } from "@/app/utils/pdfjsClient";

/**
 * @param {File} file
 * @param {{ onProgress?: (p: { progress: number, statusLabel: string }) => void }} [opts]
 */
export async function processSopPdfVisionOnly(file, { onProgress } = {}) {
  const report = (progress, statusLabel) => onProgress?.({ progress, statusLabel });

  report(2, "Memproses dokumen...");
  report(5, "Membaca PDF...");
  const arrayBuffer = await file.arrayBuffer();

  const pdfjsLib = await ensurePdfWorker();
  const data = new Uint8Array(arrayBuffer);
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const total = pdf.numPages;

  const { renderPdfPageToPngBase64 } = await import("@/app/utils/renderPdfPageToImage");

  report(15, `Merender ${total} halaman ke gambar...`);
  const visionPages = [];

  for (let p = 1; p <= total; p++) {
    const pct = 15 + Math.round((55 * p) / total);
    report(pct, `Render halaman ${p} / ${total}...`);
    try {
      const imageBase64 = await renderPdfPageToPngBase64(arrayBuffer, p, { pdf });
      visionPages.push({ page: p, imageBase64, mime: "image/png" });
    } catch (err) {
      console.warn("[SOP Vision] render page failed", p, err);
    }
  }

  try {
    if (typeof pdf.destroy === "function") pdf.destroy();
  } catch {
    /* ignore */
  }

  if (visionPages.length === 0) {
    return {
      success: false,
      error: "Gagal merender halaman PDF ke gambar.",
    };
  }

  report(75, "Mengirim ke GPT Vision...");
  const form = new FormData();
  form.append("pdf", file, file.name || "document.pdf");
  form.append("pipeline", "vision");
  form.append("visionPages", JSON.stringify(visionPages));
  form.append("debug", "true");

  const res = await fetch("/api/Ai/extract-steps", { method: "POST", body: form });
  report(90, "Memproses respons GPT Vision...");
  const json = await res.json().catch(() => ({}));

  report(100, "Selesai");
  return {
    ...json,
    extractMode: "vision",
    visionPageCount: visionPages.length,
    arrayBuffer,
  };
}

export { isVisionOnlyExtractMode };
