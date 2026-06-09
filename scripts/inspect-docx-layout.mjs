import fs from "fs";
import PizZip from "pizzip";

const path = process.argv[2] || "data/reports/shared-report-2026.docx";
const xml = new PizZip(fs.readFileSync(path)).file("word/document.xml")?.asText() || "";

const anchors = [
  ["Findings title", /Findings\s*(?:&amp;|&)\s*Recommendations/i],
  ["finance sop", /kias_sys_finding_finance_sop/i],
  ["finance audit", /kias_sys_finding_finance_audit/i],
  ["finance exec", /kias_sys_finding_finance_exec_summary/i],
  ["accounting audit", /kias_sys_finding_accounting_audit/i],
  ["sectPr (doc end)", /<w:sectPr/i],
];

for (const [label, re] of anchors) {
  const m = xml.match(re);
  console.log(label, m?.index ?? "NOT FOUND");
}

const finAuditCount = (xml.match(/kias_sys_finding_finance_audit/gi) || []).length;
console.log("finance audit bookmark occurrences:", finAuditCount);

// Text between findings title and first finance sop
const ft = xml.search(/Findings\s*(?:&amp;|&)\s*Recommendations/i);
const fsop = xml.search(/kias_sys_finding_finance_sop/i);
if (ft >= 0 && fsop >= 0) {
  const between = xml.slice(ft, fsop);
  const tbl = (between.match(/<w:tbl/g) || []).length;
  const paras = (between.match(/<w:p[ >]/g) || []).length;
  console.log("between findings title and finance sop: tables", tbl, "paragraphs", paras, "chars", between.length);
}
