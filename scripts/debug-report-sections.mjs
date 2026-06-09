/**
 * Cek model section SEBELUM DOCX — USER vs SYSTEM setelah lock/unlock.
 *
 *   node --env-file=.env scripts/debug-report-sections.mjs 2026
 */
import pkg from "pg";

const USER_SECTIONS = [
  "cover",
  "executive_summary",
  "audit_objectives_scope",
  "audit_approach_methodology",
  "findings_free",
  "conclusion",
  "appendices",
];
const SYSTEM_SECTIONS = ["findings_module_tables"];

function buildModel(state) {
  const findingSections = Array.isArray(state.findingSections) ? state.findingSections : [];
  const papers = state.reportPapers && typeof state.reportPapers === "object" ? state.reportPapers : {};
  const sections = [];

  for (const id of USER_SECTIONS) {
    let hasContent = false;
    const detail = {};
    if (id === "executive_summary") hasContent = Boolean(String(state.executiveSummaryHtml || "").trim());
    if (id === "audit_objectives_scope") hasContent = Boolean(String(state.auditObjectivesScopeHtml || "").trim());
    if (id === "audit_approach_methodology") hasContent = Boolean(String(state.auditApproachMethodologyHtml || "").trim());
    if (id === "findings_free") {
      hasContent = Boolean(String(state.userFindingsFreeHtml || "").trim());
      detail.htmlLength = String(state.userFindingsFreeHtml || "").length;
    }
    if (id === "conclusion") {
      const keys = Object.keys(state.conclusionValues || {}).filter((k) =>
        String(state.conclusionValues[k] ?? "").trim(),
      );
      hasContent = keys.length > 0;
      detail.deptWithText = keys;
    }
    if (id === "appendices") {
      hasContent = Array.isArray(state.appendices) && state.appendices.length > 0;
      detail.count = state.appendices?.length ?? 0;
    }
    if (papers[id]?.hash) hasContent = true;
    sections.push({ id, type: "user", inModel: true, hasContent, detail });
  }

  sections.push({
    id: "findings_module_tables",
    type: "system",
    inModel: true,
    hasContent: findingSections.some(
      (s) => (s.sopRows?.length || 0) > 0 || (s.auditRows?.length || 0) > 0,
    ),
    detail: {
      deptCount: findingSections.length,
      depts: findingSections.map((s) => ({
        deptKey: s.deptKey,
        sop: s.sopRows?.length ?? 0,
        audit: s.auditRows?.length ?? 0,
        published: s.isPublishedToReport === true,
      })),
      manifestBlocks: (state.reportBlocks?.manifest || []).length,
    },
  });

  return { sections, userPapers: Object.keys(papers), manifest: state.reportBlocks?.manifest || [] };
}

const year = Number(process.argv[2] || 2026);
const pool = new pkg.Pool({ connectionString: process.env.DATABASE_URL });

const hub = await pool.query(
  `SELECT state_json FROM consolidated_report_state WHERE audit_year = $1`,
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

const model = buildModel(state);

console.log("=== Report section model (hub DB) ===");
console.log("year:", year);
console.log("auditVisibleByDept:", state.auditVisibleByDept);
console.log("hubRevision:", state.hubRevision);
console.log("onlyOfficeSyncRevision:", state.onlyOfficeSyncRevision);
console.log("userPapers:", model.userPapers);
console.log("reportBlocks.manifest:", model.manifest);
console.log("");
for (const s of model.sections) {
  console.log(
    `[${s.type}] ${s.id}`,
    "inModel",
    s.hasContent ? "hasContent" : "empty",
    Object.keys(s.detail).length ? JSON.stringify(s.detail) : "",
  );
}
console.log("");
console.log(
  "Jika USER section inModel tapi HTML Preview paper hilang → bug di renderer (Kasus B).",
);
console.log(
  "Jika USER section tidak inModel di DB → bug persist/model sebelum DOCX.",
);

await pool.end();
