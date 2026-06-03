import { buildConsolidatedReportDocx } from "./buildConsolidatedReport";
import { buildReportFromDocxTemplate } from "./docxtemplaterEngine";

/**
 * DOCX engine selection (see ARCHITECTURE.md).
 * - docxjs (default): programmatic layout — consolidated report
 * - docxtemplater: Word template + placeholders
 */
export function getReportDocxEngine() {
  return String(process.env.REPORT_DOCX_ENGINE || "docxjs").toLowerCase();
}

/**
 * @param {object} payload Report snapshot from preview / modules
 * @returns {Promise<Buffer>}
 */
export async function generateReportDocx(payload) {
  const engine = getReportDocxEngine();

  if (engine === "docxtemplater" || engine === "template") {
    return buildReportFromDocxTemplate(payload);
  }

  return buildConsolidatedReportDocx(payload);
}
