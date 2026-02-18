export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@/app/api/SopReview/_shared/pool";

const SOP_TABLES = [
  { apiPath: "finance", table: "sops_finance" },
  { apiPath: "accounting", table: "sops_accounting" },
  { apiPath: "hrd", table: "sops_hrd" },
  { apiPath: "g&a", table: "sops_g_a" },
  { apiPath: "sdp", table: "sops_sdp" },
  { apiPath: "tax", table: "sops_tax" },
  { apiPath: "l&p", table: "sops_l_p" },
  { apiPath: "mis", table: "sops_mis" },
  { apiPath: "merch", table: "sops_merch" },
  { apiPath: "ops", table: "sops_ops" },
  { apiPath: "whs", table: "sops_whs" },
];

/**
 * GET /api/SopReview/status
 * Returns status for all departments in one request (one connection, parallel checks).
 */
export async function GET() {
  const client = await pool.connect();
  try {
    const results = await Promise.all(
      SOP_TABLES.map(async ({ apiPath, table }) => {
        const hasRows = await client
          .query(`SELECT 1 FROM public.${table} LIMIT 1`)
          .then((r) => (r?.rowCount ?? 0) > 0)
          .catch(() => false);
        return { apiPath, status: hasRows ? "AVAILABLE" : "Not Available" };
      })
    );
    const statusByDept = Object.fromEntries(results.map((r) => [r.apiPath, r.status]));
    return NextResponse.json({ success: true, statuses: statusByDept }, { status: 200 });
  } catch (err) {
    console.error("GET /api/SopReview/status error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
