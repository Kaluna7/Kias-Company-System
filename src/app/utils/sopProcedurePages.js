import { PAGE_SEPARATOR } from "@/app/lib/pdf/buildPageText";

const PROCEDURE_START =
  /\b5\s*\.\s*Prosedur\b|\bProsedur\s+Kerja\b|\bALUR\s+PROSEDUR\b|\bNO\s+PROSEDUR\s+KERJA\b/i;
const PROCEDURE_END =
  /(?:^|\n)\s*(?:Catatan|Dokumen Pendukung|Revisi|Persetujuan|Lampiran|Penutup)\s*(?:\n|$|:)/i;
const PROCEDURE_TABLE_HINT =
  /\bNO\s*PROSEDUR\b|\bPROSEDUR\s+KERJA\b|\bALUR\s+(?:KERJA|PROSEDUR)\b/i;

export function splitPagesFromFullText(fullText) {
  const parts = (fullText || "").split(/\n\n---PAGE---\n\n/);
  return parts.map((text, i) => ({
    page: i + 1,
    text: text || "",
    charCount: (text || "").replace(/\s+/g, "").length,
  }));
}

/**
 * Halaman yang memuat tabel prosedur — perlu OCR meski teks parser panjang (gambar/diagram di sel).
 */
export function getProcedureTablePageNumbers(fullText) {
  const pages = splitPagesFromFullText(fullText);
  const hits = [];
  let inProcedure = false;

  for (const p of pages) {
    const t = p.text || "";
    if (PROCEDURE_START.test(t) || PROCEDURE_TABLE_HINT.test(t)) {
      inProcedure = true;
    }
    if (inProcedure) {
      hits.push(p.page);
      if (PROCEDURE_END.test(t) && !PROCEDURE_TABLE_HINT.test(t.slice(0, 200))) {
        inProcedure = false;
      }
    }
  }

  return [...new Set(hits)];
}

const MIN_PAGE_CHARS = 120;

/**
 * Sparse pages + semua halaman tabel prosedur (untuk teks di gambar).
 */
export function getPagesNeedingOcrFromFullText(fullText) {
  const pages = splitPagesFromFullText(fullText);
  const procedurePages = new Set(getProcedureTablePageNumbers(fullText));
  const need = new Set();

  for (const p of pages) {
    const words = (p.text || "").split(/\s+/).filter(Boolean).length;
    const sparse = p.charCount < MIN_PAGE_CHARS || words < 15;
    if (sparse || procedurePages.has(p.page)) {
      need.add(p.page);
    }
  }

  return [...need]
    .sort((a, b) => a - b)
    .map((page) => {
      const found = pages.find((x) => x.page === page);
      return found || { page, text: "", charCount: 0 };
    });
}
