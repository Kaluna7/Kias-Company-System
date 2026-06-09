/**
 * Pulihkan findingSections di hub DB dari modul (via API internal).
 * Jalankan saat hub menampilkan auditRows/sopRows = 0 padahal modul punya data.
 *
 *   node --env-file=.env scripts/heal-report-modules.mjs 2026
 *
 * Butuh dev server jalan (pnpm dev) dan sesi login di browser.
 * Set HEAL_SESSION_COOKIE di .env dari cookie browser (opsional).
 */
import pkg from "pg";

const year = Number(process.argv[2] || 2026);
const base = (process.env.INTERNAL_APP_URL || process.env.INTERNAL_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/+$/, "");
const cookie = process.env.HEAL_SESSION_COOKIE || "";

const pool = new pkg.Pool({ connectionString: process.env.DATABASE_URL });

function before(state) {
  const fin = (state.findingSections || []).find((s) => s.deptKey === "finance");
  console.log("BEFORE finance:", {
    sections: (state.findingSections || []).length,
    audit: fin?.auditRows?.length ?? 0,
    sop: fin?.sopRows?.length ?? 0,
  });
}

async function healViaApi() {
  const res = await fetch(`${base}/api/report/hub/sync-modules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ year }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || `sync-modules failed (${res.status})`);
  }
  const fin = (json.sections || json.state?.findingSections || []).find(
    (s) => s.deptKey === "finance",
  );
  console.log("AFTER API heal finance:", {
    sections: (json.sections || json.state?.findingSections || []).length,
    audit: fin?.auditRows?.length ?? 0,
    sop: fin?.sopRows?.length ?? 0,
  });
  return json;
}

const hub = await pool.query(
  `SELECT state_json FROM consolidated_report_state WHERE audit_year = $1`,
  [year],
);
let state =
  typeof hub.rows[0]?.state_json === "string"
    ? JSON.parse(hub.rows[0].state_json)
    : hub.rows[0]?.state_json || {};
before(state);

try {
  await healViaApi();
  const after = await pool.query(
    `SELECT state_json FROM consolidated_report_state WHERE audit_year = $1`,
    [year],
  );
  state =
    typeof after.rows[0]?.state_json === "string"
      ? JSON.parse(after.rows[0].state_json)
      : after.rows[0]?.state_json || {};
  before(state);
  console.log("Heal selesai. Hard refresh HTML Preview.");
} catch (err) {
  console.error("Heal gagal:", err.message);
  console.error(
    "Login ke app di browser, salin cookie session ke HEAL_SESSION_COOKIE di .env, lalu jalankan lagi.",
  );
  process.exit(1);
} finally {
  await pool.end();
}
