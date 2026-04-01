export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { pool } from "@/app/api/SopReview/_shared/pool";
import { resolveSopDept } from "@/app/api/SopReview/_shared/dept";
import { requireSopPublisher } from "@/app/api/SopReview/_shared/auth";

// Map apiPath to schedule department_id
const API_PATH_TO_SCHEDULE_ID = {
  finance: "A1.1",
  accounting: "A1.2",
  hrd: "A1.3",
  "g&a": "A1.4",
  sdp: "A1.5",
  tax: "A1.6",
  "l&p": "A1.7",
  mis: "A1.8",
  merch: "A1.9",
  ops: "A1.10",
  whs: "A1.11",
};

async function getScheduleDataForDepartment(apiPath) {
  try {
    const scheduleDeptId = API_PATH_TO_SCHEDULE_ID[apiPath];
    if (!scheduleDeptId) return null;

    const scheduleClient = await pool.connect();
    try {
      // Check if schedule table exists
      const checkTable = await scheduleClient.query(
        "SELECT to_regclass($1) AS t",
        ["public.schedule_module_feedback"]
      );
      if (!checkTable?.rows?.[0]?.t) return null;

      const res = await scheduleClient.query(
        `SELECT start_date, end_date, user_name 
         FROM public.schedule_module_feedback 
         WHERE module_key = 'sop-review' AND department_id = $1 AND is_configured = true 
         ORDER BY id DESC LIMIT 1`,
        [scheduleDeptId]
      );

      if (res.rows && res.rows.length > 0) {
        return res.rows[0];
      }
      return null;
    } finally {
      scheduleClient.release();
    }
  } catch (err) {
    console.error("Error fetching schedule data:", err);
    return null;
  }
}

async function ensureReportTables(client, slug, departmentName) {
  const stepsTable = `sops_report_${slug}`;
  const metaTable = `sop_report_${slug}`;

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${stepsTable} (
      id SERIAL PRIMARY KEY,
      no INTEGER,
      sop_related TEXT,
      status VARCHAR(20) DEFAULT 'DRAFT',
      comment TEXT DEFAULT '',
      reviewer_feedback TEXT DEFAULT '',
      reviewer VARCHAR(255) DEFAULT '',
      published_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = '${stepsTable}' AND column_name = 'report_meta_id') THEN
        ALTER TABLE ${stepsTable} ADD COLUMN report_meta_id INTEGER;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = '${stepsTable}' AND column_name = 'reviewer_feedback') THEN
        ALTER TABLE ${stepsTable} ADD COLUMN reviewer_feedback TEXT DEFAULT '';
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${metaTable} (
      id SERIAL PRIMARY KEY,
      department_name VARCHAR(255) DEFAULT '${String(departmentName || "").replace(/'/g, "''")}',
      sop_status VARCHAR(50),
      preparer_status VARCHAR(50),
      preparer_name VARCHAR(255),
      preparer_date DATE,
      reviewer_comment TEXT,
      reviewer_status VARCHAR(50),
      reviewer_name VARCHAR(255),
      reviewer_date DATE,
      audit_fieldwork_start_date DATE,
      audit_fieldwork_end_date DATE,
      published_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  
  // Add columns if they don't exist (for existing tables)
  await client.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = '${metaTable}' AND column_name = 'audit_fieldwork_start_date') THEN
        ALTER TABLE ${metaTable} ADD COLUMN audit_fieldwork_start_date DATE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = '${metaTable}' AND column_name = 'audit_fieldwork_end_date') THEN
        ALTER TABLE ${metaTable} ADD COLUMN audit_fieldwork_end_date DATE;
      END IF;
    END $$;
  `);

  return { stepsTable, metaTable };
}

export async function POST(req, { params }) {
  try {
    // Reviewer atau admin boleh Publish SOP ke Report
    const authError = await requireSopPublisher();
    if (authError) return authError;

    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const resolved = resolveSopDept(dept);
    if (!resolved) return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });

    const slug = resolved.slug;
    const stepsTable = `sops_${slug}`;
    const metaTable = `sop_${slug}`;

    // Read steps + meta from body (single source of truth - avoids race with save and duplicate rows in report)
    let bodySteps = null;
    let bodyMeta = null;
    try {
      const body = await req.json().catch(() => null);
      if (body) {
        if (Array.isArray(body.steps) && body.steps.length > 0) bodySteps = body.steps;
        if (body.meta && typeof body.meta === "object") bodyMeta = body.meta;
      }
    } catch (_) {}

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Ensure source tables exist (same schema as steps/meta handlers)
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${stepsTable} (
          id SERIAL PRIMARY KEY,
          no INTEGER,
          sop_related TEXT,
          status VARCHAR(20) DEFAULT 'DRAFT',
          comment TEXT DEFAULT '',
          reviewer_feedback TEXT DEFAULT '',
          reviewer VARCHAR(255) DEFAULT ''
        );
      `);
      await client.query(`
        ALTER TABLE ${stepsTable}
        ADD COLUMN IF NOT EXISTS reviewer_feedback TEXT DEFAULT '';
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${metaTable} (
          id SERIAL PRIMARY KEY,
          department_name VARCHAR(255),
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

      const { stepsTable: reportSteps, metaTable: reportMeta } = await ensureReportTables(
        client,
        slug,
        resolved.departmentName
      );

      // Advisory lock per department: only one publish at a time per dept (prevents double rows in sops_report_*)
      const lockKey = Math.abs(String("sop-pub-" + slug).split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0) % 0x7FFFFFFF);
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);

      let steps;
      let meta;

      if (bodySteps && bodySteps.length > 0) {
        // Use body as single source of truth - no DB read, no race, no duplicate rows
        const seen = new Set();
        steps = bodySteps.filter((s) => {
          const no = Number(s.no);
          const norm = String(s.sop_related ?? "").replace(/\s+/g, " ").trim();
          const key = `${Number.isNaN(no) ? "" : no}\t${norm}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        meta = bodyMeta ?? null;
      } else {
        // Fallback: read from DB (legacy or when body not sent)
        await client.query(`LOCK TABLE ${stepsTable} IN EXCLUSIVE MODE`);
        await client.query(`LOCK TABLE ${metaTable} IN EXCLUSIVE MODE`);
        const stepsRes = await client.query(
          `SELECT no, sop_related, status, comment, reviewer_feedback, reviewer FROM ${stepsTable} ORDER BY no ASC NULLS LAST, id ASC`
        );
        const rawSteps = stepsRes.rows || [];
        const seen = new Set();
        steps = rawSteps.filter((s) => {
          const no = Number(s.no);
          const norm = String(s.sop_related ?? "").replace(/\s+/g, " ").trim();
          const key = `${Number.isNaN(no) ? "" : no}\t${norm}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const metaRes = await client.query(`SELECT * FROM ${metaTable} ORDER BY id DESC LIMIT 1`);
        meta = metaRes.rows?.[0] ?? null;
      }

      if (!steps || steps.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "No SOP data to publish" }, { status: 400 });
      }

      // Get schedule data for audit fieldwork dates
      const scheduleData = await getScheduleDataForDepartment(slug);
      const auditFieldworkStartDate = scheduleData?.start_date || null;
      const auditFieldworkEndDate = new Date().toISOString().split('T')[0]; // Today's date (publish date)

      // Insert meta first, then steps with report_meta_id (agar setiap publish punya baris terpisah)
      let reportMetaId = null;
      if (meta) {
        const metaInsert = await client.query(
          `INSERT INTO ${reportMeta}
            (department_name, sop_status, preparer_status, preparer_name, preparer_date, reviewer_comment, reviewer_status, reviewer_name, reviewer_date, audit_fieldwork_start_date, audit_fieldwork_end_date, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
           RETURNING id`,
          [
            meta.department_name || resolved.departmentName,
            "AVAILABLE",
            meta.preparer_status || "DRAFT",
            meta.preparer_name || null,
            meta.preparer_date || null,
            meta.reviewer_comment || null,
            meta.reviewer_status || "DRAFT",
            meta.reviewer_name || null,
            meta.reviewer_date || null,
            auditFieldworkStartDate,
            auditFieldworkEndDate,
          ]
        );
        reportMetaId = metaInsert?.rows?.[0]?.id ?? null;
      }

      // Batch insert all steps in one query (prevents double rows from any race)
      if (steps.length > 0) {
        const values = [];
        const params = [];
        let idx = 1;
        for (const s of steps) {
          values.push(`($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},NOW(),$${idx + 6})`);
          params.push(s.no ?? null, s.sop_related ?? "", s.status ?? "DRAFT", s.comment ?? "", s.reviewer_feedback ?? "", s.reviewer ?? "", reportMetaId);
          idx += 7;
        }
        await client.query(
          `INSERT INTO ${reportSteps} (no, sop_related, status, comment, reviewer_feedback, reviewer, published_at, report_meta_id) VALUES ${values.join(", ")}`,
          params
        );
      }

      // Clear department data after publish
      await client.query(`TRUNCATE TABLE ${stepsTable} RESTART IDENTITY`);
      await client.query(`TRUNCATE TABLE ${metaTable} RESTART IDENTITY`);

      await client.query("COMMIT");

      // Ensure pages show newest published data immediately
      try {
        revalidatePath("/Page/sop-review/report");
        revalidatePath("/Page/sop-review");
      } catch (e) {
        // ignore cache revalidation failures; publish is already committed
      }

      return NextResponse.json({ success: true, published: steps.length }, { status: 200 });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Publish SOP error:", err);
      return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("POST /api/SopReview/[dept]/publish error:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}


