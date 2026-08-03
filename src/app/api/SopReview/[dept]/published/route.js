export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { pool } from "@/app/api/SopReview/_shared/pool";
import { resolveSopDept } from "@/app/api/SopReview/_shared/dept";
import { requireSopReportPublishedEditor } from "@/app/api/SopReview/_shared/auth";
import { notifySopReviewDataFromServer } from "@/app/lib/sop-review/broadcastFromServer";

function toPgDate(v) {
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS auditee_comment TEXT DEFAULT ''`);
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS follow_up_detail TEXT DEFAULT ''`);
  } catch (e) {
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN report_meta_id INTEGER`).catch(() => {});
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN reviewer_feedback TEXT DEFAULT ''`).catch(() => {});
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN auditee_comment TEXT DEFAULT ''`).catch(() => {});
    await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN follow_up_detail TEXT DEFAULT ''`).catch(() => {});
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

async function ensureDraftTables(client, slug, departmentName) {
  const stepsTable = `sops_${slug}`;
  const metaTable = `sop_${slug}`;
  const safeDept = String(departmentName || "").replace(/'/g, "''");

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${stepsTable} (
      id SERIAL PRIMARY KEY,
      no INTEGER,
      sop_related TEXT,
      status VARCHAR(20) DEFAULT 'DRAFT',
      comment TEXT DEFAULT '',
      reviewer_feedback TEXT DEFAULT '',
      reviewer VARCHAR(255) DEFAULT '',
      auditee_comment TEXT DEFAULT '',
      follow_up_detail TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS reviewer_feedback TEXT DEFAULT ''`);
  await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS auditee_comment TEXT DEFAULT ''`);
  await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS follow_up_detail TEXT DEFAULT ''`);
  await client.query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${metaTable} (
      id SERIAL PRIMARY KEY,
      department_name VARCHAR(255) DEFAULT '${safeDept}',
      sop_status VARCHAR(50),
      preparer_status VARCHAR(50),
      preparer_name VARCHAR(255),
      preparer_date DATE,
      reviewer_comment TEXT,
      reviewer_status VARCHAR(50),
      reviewer_name VARCHAR(255),
      reviewer_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  return { stepsTable, metaTable };
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
          `SELECT id, no, sop_related, status, comment, reviewer_feedback, reviewer, auditee_comment, follow_up_detail, published_at FROM ${stepsTable} WHERE report_meta_id = ${metaId} ORDER BY no ASC NULLS LAST, id ASC`,
        );
        publishes.push({ meta, rows: steps });
      }
      return NextResponse.json(
        { success: true, publishes },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        },
      );
    }

    const [rows, metaRows] = await Promise.all([
      selectMaybe(stepsTable, `SELECT id, no, sop_related, status, comment, reviewer_feedback, reviewer, auditee_comment, follow_up_detail, published_at FROM ${stepsTable} ORDER BY no ASC NULLS LAST, id ASC`),
      selectMaybe(metaTable, `SELECT id, department_name, sop_status, preparer_status, preparer_name, preparer_date, reviewer_comment, reviewer_status, reviewer_name, reviewer_date, audit_fieldwork_start_date, audit_fieldwork_end_date, published_at FROM ${metaTable} ORDER BY id DESC LIMIT 1`),
    ]);

    return NextResponse.json({ success: true, meta: metaRows?.[0] ?? null, rows }, { status: 200 });
  } catch (err) {
    console.error("GET /api/SopReview/[dept]/published error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

/**
 * DELETE: unpublish (restore to department) by default, or hard-delete report only.
 * Body: { meta_ids: number[], restore?: boolean (default true), force?: boolean }
 */
export async function DELETE(req, { params }) {
  const authError = await requireSopReportPublishedEditor();
  if (authError) return authError;

  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const resolved = resolveSopDept(dept);
    if (!resolved) return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const metaIdsRaw = body?.meta_ids;
    if (!Array.isArray(metaIdsRaw) || metaIdsRaw.length === 0) {
      return NextResponse.json(
        { success: false, error: "Body must include non-empty meta_ids array" },
        { status: 400 },
      );
    }

    const restore = body?.restore !== false;
    const force = body?.force === true;

    const reportStepsTable = `sops_report_${resolved.slug}`;
    const reportMetaTable = `sop_report_${resolved.slug}`;
    const metaIds = metaIdsRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    if (metaIds.length === 0) {
      return NextResponse.json({ success: false, error: "No valid meta_ids" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await ensureReportMetaIdColumn(reportStepsTable);
      await ensureReportMetaColumns(reportMetaTable);
      const { stepsTable: draftSteps, metaTable: draftMeta } = await ensureDraftTables(
        client,
        resolved.slug,
        resolved.departmentName,
      );

      await client.query("BEGIN");

      if (restore) {
        if (metaIds.length !== 1) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              success: false,
              error: "Unpublish restores one published record at a time.",
            },
            { status: 400 },
          );
        }

        const metaId = metaIds[0];
        const metaRes = await client.query(`SELECT * FROM ${reportMetaTable} WHERE id = $1`, [metaId]);
        const meta = metaRes.rows?.[0];
        if (!meta) {
          await client.query("ROLLBACK");
          return NextResponse.json({ success: false, error: "Published record not found" }, { status: 404 });
        }

        const draftCountRes = await client.query(`SELECT COUNT(*)::int AS n FROM ${draftSteps}`);
        const draftCount = draftCountRes.rows?.[0]?.n ?? 0;
        if (draftCount > 0 && !force) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            {
              success: false,
              code: "DRAFT_NOT_EMPTY",
              error:
                "Department page already has SOP data. Unpublish would overwrite it. Confirm overwrite or clear the department first.",
              draftCount,
            },
            { status: 409 },
          );
        }

        const stepsRes = await client.query(
          `SELECT no, sop_related, status, comment, reviewer_feedback, reviewer, auditee_comment, follow_up_detail
           FROM ${reportStepsTable}
           WHERE report_meta_id = $1
           ORDER BY no ASC NULLS LAST, id ASC`,
          [metaId],
        );
        const steps = stepsRes.rows || [];

        await client.query(`TRUNCATE TABLE ${draftSteps} RESTART IDENTITY`);
        await client.query(`TRUNCATE TABLE ${draftMeta} RESTART IDENTITY`);

        await client.query(
          `INSERT INTO ${draftMeta}
            (department_name, sop_status, preparer_status, preparer_name, preparer_date,
             reviewer_comment, reviewer_status, reviewer_name, reviewer_date, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())`,
          [
            meta.department_name || resolved.departmentName,
            meta.sop_status || "AVAILABLE",
            meta.preparer_status || "DRAFT",
            meta.preparer_name || null,
            meta.preparer_date || null,
            meta.reviewer_comment || null,
            meta.reviewer_status || "DRAFT",
            meta.reviewer_name || null,
            meta.reviewer_date || null,
          ],
        );

        for (const s of steps) {
          await client.query(
            `INSERT INTO ${draftSteps}
              (no, sop_related, status, comment, reviewer_feedback, reviewer, auditee_comment, follow_up_detail)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              s.no ?? null,
              s.sop_related ?? "",
              s.status ?? "DRAFT",
              s.comment ?? "",
              s.reviewer_feedback ?? "",
              s.reviewer ?? "",
              s.auditee_comment ?? "",
              s.follow_up_detail ?? "",
            ],
          );
        }

        await client.query(`DELETE FROM ${reportStepsTable} WHERE report_meta_id = $1`, [metaId]);
        await client.query(`DELETE FROM ${reportMetaTable} WHERE id = $1`, [metaId]);
      } else {
        for (const metaId of metaIds) {
          const exists = await client.query(`SELECT id FROM ${reportMetaTable} WHERE id = $1`, [metaId]);
          if (!exists?.rows?.length) continue;
          await client.query(`DELETE FROM ${reportStepsTable} WHERE report_meta_id = $1`, [metaId]);
          await client.query(`DELETE FROM ${reportMetaTable} WHERE id = $1`, [metaId]);
        }
      }

      await client.query("COMMIT");
      try {
        revalidatePath("/Page/sop-review/report");
        revalidatePath("/Page/sop-review");
        revalidatePath("/Page/dashboard");
      } catch (_) {
        /* ignore */
      }
      notifySopReviewDataFromServer(dept, { action: restore ? "unpublish" : "delete" });
      return NextResponse.json({ success: true, restored: restore }, { status: 200 });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("DELETE /api/SopReview/[dept]/published error:", err);
      return NextResponse.json(
        { success: false, error: err?.message ?? String(err) },
        { status: 500 },
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("DELETE /api/SopReview/[dept]/published outer error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

/**
 * PATCH: update published report meta + step rows (reviewer/admin only).
 * Body: { updates: [{ meta_id, meta, steps, deleted_step_ids?: number[] }] }
 */
export async function PATCH(req, { params }) {
  const authError = await requireSopReportPublishedEditor();
  if (authError) return authError;

  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const resolved = resolveSopDept(dept);
    if (!resolved) return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const updates = body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "Body must include non-empty updates array" },
        { status: 400 },
      );
    }

    const stepsTable = `sops_report_${resolved.slug}`;
    const metaTable = `sop_report_${resolved.slug}`;

    const client = await pool.connect();
    try {
      await ensureReportMetaIdColumn(stepsTable);
      await ensureReportMetaColumns(metaTable);

      await client.query("BEGIN");

      for (const u of updates) {
        const metaId = Number(u.meta_id);
        if (!Number.isFinite(metaId) || metaId <= 0) {
          throw new Error("Each update must include a valid meta_id");
        }

        const exists = await client.query(`SELECT id FROM ${metaTable} WHERE id = $1`, [metaId]);
        if (!exists?.rows?.length) {
          throw new Error(`Published meta not found: ${metaId}`);
        }

        const deletedStepIds = Array.isArray(u.deleted_step_ids)
          ? u.deleted_step_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
          : [];
        for (const sid of deletedStepIds) {
          await client.query(`DELETE FROM ${stepsTable} WHERE id = $1 AND report_meta_id = $2`, [sid, metaId]);
        }

        const m = u.meta && typeof u.meta === "object" ? u.meta : {};

        await client.query(
          `UPDATE ${metaTable}
           SET preparer_status = $2,
               preparer_name = $3,
               preparer_date = $4,
               reviewer_comment = $5,
               reviewer_status = $6,
               reviewer_name = $7,
               reviewer_date = $8,
               audit_fieldwork_start_date = $9,
               audit_fieldwork_end_date = $10,
               department_name = COALESCE($11, department_name)
           WHERE id = $1`,
          [
            metaId,
            m.preparer_status != null ? String(m.preparer_status) : null,
            m.preparer_name != null ? String(m.preparer_name) : null,
            toPgDate(m.preparer_date),
            m.reviewer_comment != null ? String(m.reviewer_comment) : null,
            m.reviewer_status != null ? String(m.reviewer_status) : null,
            m.reviewer_name != null ? String(m.reviewer_name) : null,
            toPgDate(m.reviewer_date),
            toPgDate(m.audit_fieldwork_start_date),
            toPgDate(m.audit_fieldwork_end_date),
            m.department_name != null ? String(m.department_name) : null,
          ],
        );

        const steps = Array.isArray(u.steps) ? u.steps : [];
        for (const s of steps) {
          const stepId = Number(s.id);
          if (!Number.isFinite(stepId) || stepId <= 0) continue;

          const own = await client.query(
            `SELECT id FROM ${stepsTable} WHERE id = $1 AND report_meta_id = $2`,
            [stepId, metaId],
          );
          if (!own?.rows?.length) continue;

          await client.query(
            `UPDATE ${stepsTable}
             SET no = $2,
                 sop_related = $3,
                 status = $4,
                 comment = $5,
                 reviewer_feedback = $6,
                 reviewer = $7,
                 auditee_comment = $8,
                 follow_up_detail = $9
             WHERE id = $1 AND report_meta_id = $10`,
            [
              stepId,
              s.no != null ? Number(s.no) : null,
              s.sop_related != null ? String(s.sop_related) : "",
              s.status != null ? String(s.status) : "DRAFT",
              s.comment != null ? String(s.comment) : "",
              s.reviewer_feedback != null ? String(s.reviewer_feedback) : "",
              s.reviewer != null ? String(s.reviewer) : "",
              s.auditee_comment != null ? String(s.auditee_comment) : "",
              s.follow_up_detail != null ? String(s.follow_up_detail) : "",
              metaId,
            ],
          );
        }
      }

      await client.query("COMMIT");

      let publishedAt = null;
      try {
        const metaRow = await client.query(
          `SELECT published_at, audit_fieldwork_end_date, audit_fieldwork_start_date FROM ${metaTable} WHERE id = $1 LIMIT 1`,
          [Number(updates[0]?.meta_id)],
        );
        publishedAt = metaRow.rows[0]?.published_at;
        notifySopReviewDataFromServer(dept, {
          action: "update",
          publishedAt,
          auditFieldworkEndDate: metaRow.rows[0]?.audit_fieldwork_end_date,
          auditFieldworkStartDate: metaRow.rows[0]?.audit_fieldwork_start_date,
        });
      } catch {
        notifySopReviewDataFromServer(dept, { action: "update" });
      }

      try {
        revalidatePath("/Page/sop-review/report");
      } catch (_) {
        /* ignore */
      }
      return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("PATCH /api/SopReview/[dept]/published error:", err);
      return NextResponse.json(
        { success: false, error: err?.message ?? String(err) },
        { status: 500 },
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("PATCH /api/SopReview/[dept]/published outer error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

