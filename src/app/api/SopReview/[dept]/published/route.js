export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@/app/api/SopReview/_shared/pool";
import { resolveSopDept } from "@/app/api/SopReview/_shared/dept";

async function selectMaybe(tableName, sql) {
  const client = await pool.connect();
  try {
    const reg = await client.query("SELECT to_regclass($1) AS t", [`public.${tableName}`]);
    if (!reg?.rows?.[0]?.t) return [];
    const r = await client.query(sql);
    return r.rows || [];
  } finally {
    client.release();
  }
}

async function ensureReportMetaIdColumn(stepsTable) {
  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='report_meta_id'`,
      [stepsTable],
    );
    if (!check?.rows?.length) {
      await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS report_meta_id INTEGER`);
    }
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS reviewer_feedback TEXT DEFAULT ''`);
  } catch (e) {
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN report_meta_id INTEGER`).catch(() => {});
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN reviewer_feedback TEXT DEFAULT ''`).catch(() => {});
  } finally {
    client.release();
  }
}

async function ensureReportMetaColumns(metaTable) {
  const client = await pool.connect();
  try {
    const reg = await client.query("SELECT to_regclass($1) AS t", [`public.${metaTable}`]);
    if (!reg?.rows?.[0]?.t) return;

    await client.query(
      `ALTER TABLE ${metaTable}
       ADD COLUMN IF NOT EXISTS audit_fieldwork_start_date DATE,
       ADD COLUMN IF NOT EXISTS audit_fieldwork_end_date DATE,
       ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;`,
    );
  } finally {
    client.release();
  }
}

export async function GET(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const resolved = resolveSopDept(dept);
    if (!resolved) return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });

    const stepsTable = `sops_report_${resolved.slug}`;
    const metaTable = `sop_report_${resolved.slug}`;

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const all = searchParams.get("all") === "1" || searchParams.get("all") === "true";
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : null;

    if (all) {
      await ensureReportMetaIdColumn(stepsTable);
      await ensureReportMetaColumns(metaTable);
      let metaRows = await selectMaybe(
        metaTable,
        `SELECT id, department_name, sop_status, preparer_status, preparer_name, preparer_date, reviewer_comment, reviewer_status, reviewer_name, reviewer_date, audit_fieldwork_start_date, audit_fieldwork_end_date, published_at FROM ${metaTable} ORDER BY id ASC`,
      );
      if (!Number.isNaN(year) && year) {
        metaRows = metaRows.filter((m) => {
          if (!m.published_at) return false;
          const d = new Date(m.published_at);
          return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
        });
      }
      const publishes = [];
      for (const meta of metaRows) {
        const metaId = Number(meta.id);
        const steps = await selectMaybe(
          stepsTable,
          `SELECT id, no, sop_related, status, comment, reviewer_feedback, reviewer, published_at FROM ${stepsTable} WHERE report_meta_id = ${metaId} ORDER BY no ASC NULLS LAST, id ASC`,
        );
        publishes.push({ meta, rows: steps });
      }
      return NextResponse.json({ success: true, publishes }, { status: 200 });
    }

    const [rows, metaRows] = await Promise.all([
      selectMaybe(stepsTable, `SELECT id, no, sop_related, status, comment, reviewer_feedback, reviewer, published_at FROM ${stepsTable} ORDER BY no ASC NULLS LAST, id ASC`),
      selectMaybe(metaTable, `SELECT id, department_name, sop_status, preparer_status, preparer_name, preparer_date, reviewer_comment, reviewer_status, reviewer_name, reviewer_date, audit_fieldwork_start_date, audit_fieldwork_end_date, published_at FROM ${metaTable} ORDER BY id DESC LIMIT 1`),
    ]);

    return NextResponse.json({ success: true, meta: metaRows?.[0] ?? null, rows }, { status: 200 });
  } catch (err) {
    console.error("GET /api/SopReview/[dept]/published error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}


