import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { pool } from "@/app/api/SopReview/_shared/pool";

function qIdent(name) {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return name;
}

const deptToSlug = {
  accounting: "accounting",
  finance: "finance",
  hrd: "hrd",
  "g&a": "ga",
  ga: "ga",
  sdp: "sdp",
  tax: "tax",
  "l&p": "lp",
  lp: "lp",
  mis: "mis",
  merch: "merch",
  ops: "ops",
  whs: "whs",
};

const deptToName = {
  accounting: "ACCOUNTING",
  finance: "FINANCE",
  hrd: "HRD",
  "g&a": "G&A",
  ga: "G&A",
  sdp: "STORE DESIGN PLANNER",
  tax: "TAX",
  "l&p": "SECURITY L&P",
  lp: "SECURITY L&P",
  mis: "MIS",
  merch: "MERCHANDISE",
  ops: "OPERATIONAL",
  whs: "WAREHOUSE",
};

export async function GET(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept?.toLowerCase();
    const slug = deptToSlug[dept];
    const departmentName = deptToName[dept] || dept?.toUpperCase() || "";

    if (!slug) {
      return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });
    }

    const metaTable = qIdent(`audit_finding_meta_${slug}`);

    const SELECT_COLUMNS = [
      "id",
      "department_name",
      "preparer_status",
      "final_status",
      "finding_result",
      "finding_result_file_name",
      "report_as",
      "prepare",
      "prepare_date",
      "review",
      "review_date",
      "created_at",
      "updated_at",
    ].join(", ");

    const client = await pool.connect();
    try {
      // Ensure table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${metaTable} (
          id SERIAL PRIMARY KEY,
          department_name VARCHAR(255) DEFAULT '${departmentName.replace(/'/g, "''")}',
          preparer_status VARCHAR(50),
          final_status VARCHAR(50),
          finding_result TEXT,
          finding_result_file_name VARCHAR(255),
          report_as VARCHAR(50),
          prepare VARCHAR(255),
          prepare_date DATE,
          review VARCHAR(255),
          review_date DATE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      const url = new URL(req.url);
      const yearParam = url.searchParams.get("year");
      const year = yearParam ? parseInt(yearParam, 10) : null;

      let r;
      if (!Number.isNaN(year) && year) {
        const from = new Date(year, 0, 1);
        const to = new Date(year + 1, 0, 1);
        r = await client.query(
          `SELECT ${SELECT_COLUMNS} FROM ${metaTable}
           WHERE created_at >= $1 AND created_at < $2
           ORDER BY id DESC
           LIMIT 1`,
          [from, to],
        );
      } else {
        // Get latest meta data (most recent)
        r = await client.query(
          `SELECT ${SELECT_COLUMNS} FROM ${metaTable} ORDER BY id DESC LIMIT 1`
        );
      }

      return NextResponse.json({ success: true, data: r.rows[0] || null }, { status: 200 });
    } catch (dbErr) {
      console.error(`DB error SELECT ${metaTable}:`, dbErr);
      return NextResponse.json({ success: false, error: "DB select failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Connection error GET /api/audit-finding/[dept]/meta:`, err);
    return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept?.toLowerCase();
    const slug = deptToSlug[dept];
    const departmentName = deptToName[dept] || dept?.toUpperCase() || "";

    if (!slug) {
      return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });
    }

    const metaTable = qIdent(`audit_finding_meta_${slug}`);

    // Read header first (before consuming body)
    const replaceMode = req.headers.get("X-Replace-Mode") === "true";

    const body = await req.json().catch(() => ({}));
    const {
      preparer_status,
      final_status,
      finding_result,
      finding_result_file_name,
      report_as,
      prepare,
      prepare_date,
      review,
      review_date,
    } = body || {};

    // Also check body parameter for replace mode
    const finalReplaceMode = replaceMode || body?.replace === true;

    const session = await getServerSession(authOptions);
    const role = (session?.user?.role || "").toLowerCase();
    const canEditFinalStatus = role === "admin" || role === "reviewer";

    const client = await pool.connect();
    try {
      // Ensure table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${metaTable} (
          id SERIAL PRIMARY KEY,
          department_name VARCHAR(255) DEFAULT '${departmentName.replace(/'/g, "''")}',
          preparer_status VARCHAR(50),
          final_status VARCHAR(50),
          finding_result TEXT,
          finding_result_file_name VARCHAR(255),
          report_as VARCHAR(50),
          prepare VARCHAR(255),
          prepare_date DATE,
          review VARCHAR(255),
          review_date DATE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query("BEGIN");

      // Final status: hanya admin/reviewer boleh mengubah; user lain pertahankan nilai terakhir (sebelum DELETE).
      let preservedFinalStatus = null;
      if (!canEditFinalStatus) {
        const prevR = await client.query(
          `SELECT final_status FROM ${metaTable} ORDER BY id DESC LIMIT 1`
        );
        preservedFinalStatus = prevR.rows[0]?.final_status ?? null;
      }

      // If replace mode, delete all existing data first
      if (finalReplaceMode) {
        await client.query(`DELETE FROM ${metaTable}`);
      }

      const finalStatusToSave = canEditFinalStatus
        ? final_status || null
        : preservedFinalStatus;

      // Insert new meta data
      const q = `
        INSERT INTO ${metaTable}
          (department_name, preparer_status, final_status, finding_result, finding_result_file_name, report_as, prepare, prepare_date, review, review_date, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id, department_name, preparer_status, final_status, finding_result, finding_result_file_name, report_as, prepare, prepare_date, review, review_date, created_at, updated_at
      `;
      const vals = [
        departmentName,
        preparer_status || null,
        finalStatusToSave,
        finding_result || null,
        finding_result_file_name || null,
        report_as || null,
        prepare || null,
        prepare_date || null,
        review || null,
        review_date || null,
      ];
      const r = await client.query(q, vals);
      await client.query("COMMIT");

      return NextResponse.json({ success: true, data: r.rows[0] }, { status: 200 });
    } catch (dbErr) {
      await client.query("ROLLBACK");
      console.error(`DB insert ${metaTable} failed:`, dbErr);
      return NextResponse.json({ success: false, error: "DB insert failed", details: String(dbErr) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Unexpected error POST /api/audit-finding/[dept]/meta:`, err);
    return NextResponse.json({ success: false, error: "Unexpected server error", details: String(err) }, { status: 500 });
  }
}

