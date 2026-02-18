export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { pool } from "@/app/api/SopReview/_shared/pool";
import { resolveSopDept } from "@/app/api/SopReview/_shared/dept";

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
      reviewer VARCHAR(255) DEFAULT '',
      published_at TIMESTAMPTZ DEFAULT NOW()
    );
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
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const resolved = resolveSopDept(dept);
    if (!resolved) return NextResponse.json({ success: false, error: "Invalid department" }, { status: 400 });

    const slug = resolved.slug;
    const stepsTable = `sops_${slug}`;
    const metaTable = `sop_${slug}`;

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
          reviewer VARCHAR(255) DEFAULT ''
        );
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

      // Load current steps
      const stepsRes = await client.query(
        `SELECT no, sop_related, status, comment, reviewer FROM ${stepsTable} ORDER BY no ASC NULLS LAST, id ASC`
      );
      const steps = stepsRes.rows || [];
      if (steps.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "No SOP data to publish" }, { status: 400 });
      }

      // Load latest meta (optional)
      const metaRes = await client.query(`SELECT * FROM ${metaTable} ORDER BY id DESC LIMIT 1`);
      const meta = metaRes.rows?.[0] ?? null;

      // Get schedule data for audit fieldwork dates
      const scheduleData = await getScheduleDataForDepartment(slug);
      const auditFieldworkStartDate = scheduleData?.start_date || null;
      const auditFieldworkEndDate = new Date().toISOString().split('T')[0]; // Today's date (publish date)

      // Insert into report tables
      for (const s of steps) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO ${reportSteps} (no, sop_related, status, comment, reviewer, published_at)
           VALUES ($1,$2,$3,$4,$5,NOW())`,
          [
            s.no ?? null,
            s.sop_related ?? "",
            s.status ?? "DRAFT",
            s.comment ?? "",
            s.reviewer ?? "",
          ]
        );
      }

      if (meta) {
        await client.query(
          `INSERT INTO ${reportMeta}
            (department_name, sop_status, preparer_status, preparer_name, preparer_date, reviewer_comment, reviewer_status, reviewer_name, reviewer_date, audit_fieldwork_start_date, audit_fieldwork_end_date, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
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


