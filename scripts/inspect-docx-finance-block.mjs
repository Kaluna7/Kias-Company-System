import fs from "fs";
import PizZip from "pizzip";

const path = process.argv[2] || "data/reports/shared-report-2026.docx";
const buf = fs.readFileSync(path);
const xml = new PizZip(buf).file("word/document.xml")?.asText() || "";

const marker = "KIASBLOCK_START_kias_sys_finding_finance_audit";
const idx = xml.indexOf(marker);
console.log("finance audit marker at:", idx);
if (idx >= 0) {
  const slice = xml.slice(idx, idx + 8000);
  const tables = (slice.match(/<w:tbl/g) || []).length;
  const texts = [...slice.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .filter((t) => t.trim().length > 2 && !t.startsWith("KIASBLOCK"))
    .slice(0, 15);
  console.log("tables in block:", tables);
  console.log("sample text:", texts);
} else {
  const bm = xml.indexOf('w:name="kias_sys_finding_finance_audit"');
  console.log("bookmark at:", bm);
  if (bm >= 0) {
    const slice = xml.slice(bm, bm + 8000);
    console.log("tables near bookmark:", (slice.match(/<w:tbl/g) || []).length);
  }
}

const allTbl = (xml.match(/<w:tbl/g) || []).length;
console.log("total tables in document:", allTbl);
