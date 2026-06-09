import fs from "fs";
import PizZip from "pizzip";

const path = process.argv[2] || "data/reports/shared-report-2026.docx";
const xml = new PizZip(fs.readFileSync(path)).file("word/document.xml")?.asText() || "";

const labels = [
  "Executive Summary",
  "Audit Objectives",
  "Audit Approach",
  "Findings",
  "Conclusion",
  "Appendices",
  "kias_user_conclusion",
  "kias_user_appendix",
  "sectPr count",
];

for (const label of labels) {
  if (label === "sectPr count") {
    console.log(label, (xml.match(/<w:sectPr/g) || []).length);
    continue;
  }
  const re =
    label.startsWith("kias")
      ? new RegExp(label, "i")
      : new RegExp(label.replace(/&/g, "(?:&amp;|&)"), "i");
  const m = xml.match(re);
  console.log(label, m?.index ?? "NOT FOUND");
}

const textRe = /<w:t[^>]*>([^<]{4,})<\/w:t>/g;
const samples = [];
let m;
while ((m = textRe.exec(xml)) !== null && samples.length < 8) {
  const t = m[1].trim();
  if (!/KIASBLOCK|kias_/.test(t)) samples.push(t.slice(0, 60));
}
console.log("sample user text:", samples);
