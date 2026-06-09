import fs from "fs";
import crypto from "crypto";
import PizZip from "pizzip";

const sessionId = process.argv[2] || "shared-report-2026";
const path = `data/reports/${sessionId}.docx`;
if (!fs.existsSync(path)) {
  console.log("MISSING", path);
  process.exit(1);
}
const buf = fs.readFileSync(path);
const zip = new PizZip(buf);
const xml = zip.file("word/document.xml")?.asText() || "";
const markers = (xml.match(/KIASBLOCK_START_kias_sys_finding/g) || []).length;
const bookmarks = (xml.match(/kias_sys_finding_[a-z0-9_]+_(?:sop|audit|exec_summary)/gi) || []).length;
const stat = fs.statSync(path);
console.log(JSON.stringify({
  path,
  size: buf.length,
  md5: crypto.createHash("md5").update(buf).digest("hex"),
  mtimeMs: stat.mtimeMs,
  markers,
  bookmarks,
  hasFindingsTitle: /Findings\s*(?:&amp;|&)\s*Recommendations/i.test(xml),
}, null, 2));
