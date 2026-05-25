/**
 * Full PDF text extraction (client — import from Client Components).
 */
import { buildPageTextsFromPdfItems, PAGE_SEPARATOR } from "@/app/lib/pdf/buildPageText";
import { ensurePdfWorker } from "@/app/utils/pdfjsClient";

export {
  buildPageTextFromPdfItems,
  buildPageTextsFromPdfItems,
  buildRightmostColumnText,
  buildAlurKerjaColumnText,
  PAGE_SEPARATOR,
} from "@/app/lib/pdf/buildPageText";

export { ensurePdfWorker } from "@/app/utils/pdfjsClient";

/**
 * @param {ArrayBuffer} arrayBuffer
 */
export async function extractFullTextFromPdfArrayBuffer(arrayBuffer) {
  const pdfjsLib = await ensurePdfWorker();
  const data = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
  const pdf = await loadingTask.promise;

  const pageTexts = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent({ includeMarkedContent: true });
    const { parserText } = buildPageTextsFromPdfItems(content.items);
    pageTexts.push(parserText);
    if (typeof page.cleanup === "function") page.cleanup();
  }

  try {
    if (typeof pdf.destroy === "function") pdf.destroy();
    if (typeof loadingTask.destroy === "function") loadingTask.destroy();
  } catch {
    /* ignore */
  }

  return pageTexts.join(PAGE_SEPARATOR);
}
