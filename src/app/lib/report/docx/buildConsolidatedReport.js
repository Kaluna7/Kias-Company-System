import { buildTemplateConsolidatedReportDocx } from "./templateBuilder";

/**
 * Build consolidated report DOCX aligned with the HTML preview template (Opsi 2 — docx.js).
 * @param {object} payload — from report preview (includes paginated pages)
 */
export async function buildConsolidatedReportDocx(payload) {
  return buildTemplateConsolidatedReportDocx(payload);
}

/** @deprecated Use generateReportDocx from ./generateReportDocx.js */
export { generateReportDocx, getReportDocxEngine } from "./generateReportDocx";
