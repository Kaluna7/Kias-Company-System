import { getDocument } from "pdfjs-serverless";
import { buildPageTextsFromPdfItems, PAGE_SEPARATOR } from "@/app/lib/pdf/buildPageText";
import { aiDebugLog } from "@/app/lib/aiDebugLog";
import { toPdfUint8Array } from "@/app/lib/sopPdfPipeline/pdfBytes";

/**
 * Server-side PDF text extraction (no worker — uses pdfjs-serverless).
 * @param {Buffer|Uint8Array|ArrayBuffer} pdfBytes
 * @returns {Promise<{ pages: Array<{ page: number, parserText: string, charCount: number }>, numPages: number }>}
 */
export async function parsePdfTextFromBuffer(pdfBytes) {
  const data = toPdfUint8Array(pdfBytes);
  const loadingTask = getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent({ includeMarkedContent: true });
    const { parserText } = buildPageTextsFromPdfItems(content.items);
    pages.push({
      page: p,
      parserText,
      charCount: parserText.replace(/\s+/g, "").length,
    });
    if (typeof page.cleanup === "function") page.cleanup();
  }

  try {
    if (typeof pdf.destroy === "function") pdf.destroy();
    if (typeof loadingTask.destroy === "function") loadingTask.destroy();
  } catch {
    /* ignore */
  }

  aiDebugLog("sop-pipeline", "pdf_parser done", {
    numPages: pages.length,
    charCounts: pages.map((x) => x.charCount),
  });

  return { pages, numPages: pages.length };
}

export function mergePagesToFullText(pages) {
  return pages.map((p) => p.finalText ?? p.parserText ?? "").join(PAGE_SEPARATOR);
}
