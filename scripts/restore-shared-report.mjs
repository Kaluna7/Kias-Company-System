/**
 * Pulihkan shared-report-{year}.docx dari backup + narasi preview.json + hub DB.
 * Usage: node --env-file=.env scripts/restore-shared-report.mjs 2026
 */
import fs from "fs";
import path from "path";
import pkg from "pg";

const year = Number(process.argv[2] || 2026);
const backupId = process.argv[3] || "8b1f0558a99813542a1480a833a75e1d";
const reportsDir = path.join(process.cwd(), "data", "reports");
const sessionId = `shared-report-${year}`;
const backupDocx = path.join(reportsDir, `${backupId}.docx`);
const targetDocx = path.join(reportsDir, `${sessionId}.docx`);

if (!fs.existsSync(backupDocx)) {
  console.error("Backup missing:", backupDocx);
  process.exit(1);
}

fs.copyFileSync(backupDocx, targetDocx);
console.log("Restored DOCX:", targetDocx, "from", backupId);

const previewPath = path.join(reportsDir, `${sessionId}.preview.json`);
let preview = {};
if (fs.existsSync(previewPath)) {
  preview = JSON.parse(fs.readFileSync(previewPath, "utf8"));
  console.log("Loaded preview payload");
}

const metaPath = path.join(reportsDir, `${sessionId}.json`);
let meta = { sessionId, year };
if (fs.existsSync(metaPath)) {
  meta = { ...JSON.parse(fs.readFileSync(metaPath, "utf8")), ...meta };
}
meta.version = Number(meta.version || 1) + 1;
meta.saveCount = 0;
meta.restoredFrom = backupId;
meta.restoredAt = new Date().toISOString();
meta.updatedAt = new Date().toISOString();
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
console.log("Updated meta, version", meta.version);

const pool = new pkg.Pool({ connectionString: process.env.DATABASE_URL });
const existing = await pool.query(
  `SELECT state_json FROM consolidated_report_state WHERE audit_year = $1`,
  [year],
);
let hub = {};
if (existing.rows[0]?.state_json) {
  hub = JSON.parse(existing.rows[0].state_json);
}

const nextHub = {
  ...hub,
  executiveSummaryHtml: preview.executiveSummaryHtml || hub.executiveSummaryHtml || "",
  auditObjectivesScopeHtml: preview.auditObjectivesScopeHtml || hub.auditObjectivesScopeHtml || "",
  auditApproachMethodologyHtml:
    preview.auditApproachMethodologyHtml || hub.auditApproachMethodologyHtml || "",
  conclusionValues: preview.conclusionValues || hub.conclusionValues || {},
  appendices: preview.appendices || hub.appendices || [],
  auditVisibleByDept: preview.auditVisibleByDept || hub.auditVisibleByDept || {},
  findingSections: preview.findingSections || hub.findingSections || hub.findingSections,
  restoredFromBackup: backupId,
  restoredAt: new Date().toISOString(),
  hubRevision: (Number(hub.hubRevision) || 0) + 1,
  hubSyncedAt: new Date().toISOString(),
};

await pool.query(
  `INSERT INTO consolidated_report_state (audit_year, state_json, updated_at, updated_by)
   VALUES ($1, $2, NOW(), $3)
   ON CONFLICT (audit_year) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
  [year, JSON.stringify(nextHub), "restore-script"],
);
await pool.end();

console.log("Hub restored. Open:", `/Page/report/editor?session=${sessionId}`);
console.log("Appendices:", Array.isArray(nextHub.appendices) ? nextHub.appendices.length : 0);
