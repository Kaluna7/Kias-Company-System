import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "report",
  "consolidated",
  "template.docx",
);

/**
 * Map consolidated report payload → Docxtemplater data object.
 * Extend when your Word template adds fields.
 */
export function mapPayloadToTemplateData(payload) {
  const year = payload?.year ?? new Date().getFullYear();
  const findings = [];

  (payload?.findingSections || []).forEach((section) => {
    (section.auditRows || []).forEach((row) => {
      findings.push({
        department: section.deptLabel || section.deptKey || "",
        title: row.findingDescription || row.findingResult || "",
        severity: row.riskLevel ?? "",
        risk_id: row.riskId || "",
        recommendation: row.recommendation || "",
      });
    });
  });

  return {
    company_name: "PT Karya Prima Unggulan",
    report_title: "INTERNAL AUDIT REPORT",
    year: String(year),
    assessment_date: payload?.issuedDate || "",
    period_start: payload?.periodStart || "",
    period_end: payload?.periodEnd || "",
    audit_coverage: payload?.auditCoverage || "",
    department_coverage: payload?.departmentCoverage || "",
    area: payload?.area || "",
    findings,
    finding_count: findings.length,
  };
}

/**
 * Opsi 1: fill `templates/report/consolidated/template.docx` (see README in that folder).
 * @param {object} payload
 * @returns {Promise<Buffer>}
 */
export async function buildReportFromDocxTemplate(payload) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `Docxtemplater template missing: ${TEMPLATE_PATH}\n` +
        "Create template.docx in Word/ONLYOFFICE or set REPORT_DOCX_ENGINE=docxjs (default).",
    );
  }

  const zip = new PizZip(fs.readFileSync(TEMPLATE_PATH));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(mapPayloadToTemplateData(payload));

  return doc.getZip().generate({ type: "nodebuffer" });
}

export function getDocxTemplatePath() {
  return TEMPLATE_PATH;
}
