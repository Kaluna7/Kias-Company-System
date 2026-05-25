import { getProcedureTablePageNumbers } from "@/app/utils/sopProcedurePages";

const MIN_PAGE_CHARS = Number(process.env.SOP_OCR_MIN_PAGE_CHARS || 120);

/**
 * Halaman perlu OCR jika teks sedikit ATAU halaman tabel prosedur (gambar di sel).
 * @param {{ page: number, charCount: number, parserText: string }} page
 * @param {string} [fullDocText] — teks gabungan untuk deteksi halaman prosedur
 */
export function pageNeedsOcr(page, fullDocText = "") {
  if (!page) return true;

  if (fullDocText) {
    const procPages = getProcedureTablePageNumbers(fullDocText);
    if (procPages.includes(page.page)) return true;
  }

  if (page.charCount < MIN_PAGE_CHARS) return true;
  const words = (page.parserText || "").split(/\s+/).filter(Boolean).length;
  if (words < 15) return true;
  return false;
}
