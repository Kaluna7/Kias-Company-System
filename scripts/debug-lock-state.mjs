import pkg from "pg";
import fs from "fs";
import PizZip from "pizzip";

const pool = new pkg.Pool({ connectionString: process.env.DATABASE_URL });

function listBlocksInDocx(path) {
  const buf = fs.readFileSync(path);
  const xml = new PizZip(buf).file("word/document.xml")?.asText() || "";
  const ids = new Set();
  const re = /kias_sys_finding_([a-z0-9_]+)_(sop|audit|exec_summary)/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const type = m[2] === "exec_summary" ? "exec-summary" : m[2];
    ids.add(`sys:finding:${m[1].replace(/_/g, ":")}:${type}`.replace(/::/g, ":"));
  }
  return [...ids].sort();
}

const year = Number(process.argv[2] || 2026);

const hub = await pool.query(
  `SELECT audit_year, state_json FROM consolidated_report_state WHERE audit_year = $1`,
  [year],
);
let state = {};
try {
  state =
    typeof hub.rows[0]?.state_json === "string"
      ? JSON.parse(hub.rows[0].state_json)
      : hub.rows[0]?.state_json || {};
} catch {
  state = {};
}
console.log("auditVisibleByDept:", state.auditVisibleByDept);
console.log("reportBlocks.manifest:", state.reportBlocks?.manifest);
const finSec = (state.findingSections || []).find((s) => s.deptKey === "finance");
console.log("hub finance section:", {
  published: finSec?.isPublishedToReport,
  auditRows: finSec?.auditRows?.length ?? 0,
  sopRows: finSec?.sopRows?.length ?? 0,
  hasExecSummary: Boolean(finSec?.executiveSummary),
});

const fin = await pool.query(
  `SELECT audit_year, is_locked FROM audit_review_executive_summary_finance WHERE audit_year = $1`,
  [year],
);
console.log("finance lock row:", fin.rows[0]);

try {
  const findings = await pool.query(
    `SELECT * FROM audit_review_findings_finance WHERE audit_year = $1 ORDER BY id DESC LIMIT 1`,
    [year],
  );
  const row = findings.rows[0];
  if (row) {
    const keys = Object.keys(row).filter((k) => !["id", "created_at", "updated_at"].includes(k));
    console.log("finance findings row keys:", keys);
    for (const k of keys) {
      const v = row[k];
      if (typeof v === "string" && v.startsWith("[")) {
        try {
          const arr = JSON.parse(v);
          console.log(`  ${k}: array length ${arr.length}`);
        } catch {
          console.log(`  ${k}: string len ${v.length}`);
        }
      } else {
        console.log(`  ${k}:`, v);
      }
    }
  } else {
    console.log("finance findings: no row for year", year);
  }
} catch (e) {
  console.log("findings query error:", e.message);
}

const docxPath = `data/reports/shared-report-${year}.docx`;
if (fs.existsSync(docxPath)) {
  console.log("docx blocks:", listBlocksInDocx(docxPath));
}

await pool.end();
