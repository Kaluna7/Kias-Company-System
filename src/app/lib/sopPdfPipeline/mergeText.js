import { PAGE_SEPARATOR } from "@/app/lib/pdf/buildPageText";
import { aiDebugLog } from "@/app/lib/aiDebugLog";
import { getProcedureTablePageNumbers } from "@/app/utils/sopProcedurePages";

function mergeParserAndOcr(parser, ocr) {
  const p = (parser || "").trim();
  const o = (ocr || "").trim();
  if (!o) return p;
  if (!p) return o;
  if (p.includes(o) || o.includes(p)) return o.length > p.length ? o : p;

  const oLines = o.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 8);
  const missing = oLines.filter((line) => !p.includes(line.slice(0, 40)));
  if (missing.length === 0) return p;
  return `${p}\n${missing.join("\n")}`;
}

/**
 * @param {Array<{ page: number, parserText: string, ocrText?: string, finalText?: string, source: string }>} pages
 */
export function mergePageTexts(pages) {
  const preview = pages.map((p) => p.parserText || "").join(PAGE_SEPARATOR);
  const procedurePages = new Set(getProcedureTablePageNumbers(preview));

  const merged = pages.map((p) => {
    const parser = (p.parserText || "").trim();
    const ocr = (p.ocrText || "").trim();
    const isProcedurePage = procedurePages.has(p.page);

    let finalText = parser;
    let source = "pdf_parser";

    if (ocr && isProcedurePage) {
      finalText = mergeParserAndOcr(parser, ocr);
      source = "pdf_parser+ocr_procedure";
    } else if (ocr && (!parser || ocr.length > parser.length * 1.2)) {
      finalText = ocr;
      source = "ocr";
    } else if (ocr && parser) {
      finalText = mergeParserAndOcr(parser, ocr);
      source = "pdf_parser+ocr";
    } else if (ocr) {
      finalText = ocr;
      source = "ocr";
    }

    return { ...p, finalText, source };
  });

  const fullText = merged.map((p) => p.finalText).join(PAGE_SEPARATOR);

  aiDebugLog("sop-pipeline", "merge_text done", {
    pages: merged.length,
    sources: merged.map((p) => ({ page: p.page, source: p.source, len: p.finalText?.length })),
    totalChars: fullText.length,
  });

  return { pages: merged, fullText };
}
