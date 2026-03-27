import { NextResponse } from "next/server";
import { pool } from "./pool";
import { requireSopEditor } from "./auth";

function qIdent(name) {
  // very small allow-list style: only lower/underscore names
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return name;
}

export function makeSopReviewTables({ slug, departmentName }) {
  const safeSlug = slug.toLowerCase();
  const stepsTable = qIdent(`sops_${safeSlug}`);
  const metaTable = qIdent(`sop_${safeSlug}`);
  const auditPeriodTable = qIdent(`audit_period_${safeSlug}`);

  return { stepsTable, metaTable, auditPeriodTable, departmentName };
}

export function makeStepsHandlers({ stepsTable }) {
  const ensureStepsTable = async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${stepsTable} (
        id SERIAL PRIMARY KEY,
        no INTEGER,
        sop_related TEXT,
        status VARCHAR(20) DEFAULT 'DRAFT',
        comment TEXT DEFAULT '',
        reviewer VARCHAR(255) DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Backfill column on existing tables if needed
    await client
      .query(`ALTER TABLE ${stepsTable} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`)
      .catch(() => {});
  };

  const GET = async (req) => {
    try {
      const client = await pool.connect();
      try {
        await ensureStepsTable(client);

        const url = new URL(req?.url || "", "http://localhost");
        const yearParam = url.searchParams.get("year");
        const year = yearParam ? parseInt(yearParam, 10) : null;

        let r;
        if (!Number.isNaN(year) && year) {
          const from = new Date(year, 0, 1);
          const to = new Date(year + 1, 0, 1);
          r = await client.query(
            `SELECT id, no, sop_related, status, comment, reviewer
             FROM ${stepsTable}
             WHERE created_at >= $1 AND created_at < $2
             ORDER BY no ASC NULLS LAST, id ASC`,
            [from, to],
          );
        } else {
          r = await client.query(
            `SELECT id, no, sop_related, status, comment, reviewer FROM ${stepsTable} ORDER BY no ASC NULLS LAST, id ASC`,
          );
        }
        return NextResponse.json({ success: true, rows: r.rows }, { status: 200 });
      } catch (dbErr) {
        console.error(`DB error SELECT ${stepsTable}:`, dbErr);
        return NextResponse.json({ success: false, error: "DB select failed", details: String(dbErr) }, { status: 500 });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Connection error GET /api/SopReview/${stepsTable}:`, err);
      return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
    }
  };

  const POST = async (req) => {
    try {
      // Hanya editor SOP (user/reviewer/admin) yang boleh menyimpan / mengubah langkah SOP
      const authError = await requireSopEditor();
      if (authError) return authError;

      // Read header first (before consuming body)
      const replaceMode = req.headers.get("X-Replace-Mode") === "true";
      
      const text = await req.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        console.error(`POST ${stepsTable}: JSON parse error. Raw body:`, text);
        return NextResponse.json({ success: false, error: "Invalid JSON", raw: text }, { status: 400 });
      }

      // Also check body parameter for replace mode
      const finalReplaceMode = replaceMode || body?.replace === true;

      let sopsArray = null;
      if (Array.isArray(body)) sopsArray = body;
      else if (Array.isArray(body?.sops)) sopsArray = body.sops;
      else if (body && typeof body === "object" && (body.sop_related || body.name)) sopsArray = [body];

      if (!sopsArray || sopsArray.length === 0) {
        return NextResponse.json({ success: false, error: "Empty/invalid payload" }, { status: 400 });
      }

      for (const it of sopsArray) {
        if (!it.sop_related && !it.name) {
          return NextResponse.json({ success: false, error: "Each item must have sop_related (or name)." }, { status: 400 });
        }
      }

      const client = await pool.connect();
      try {
        await ensureStepsTable(client);
        await client.query("BEGIN");
        
        // If replace mode, delete all existing data first
        if (finalReplaceMode) {
          await client.query(`DELETE FROM ${stepsTable}`);
        }
        
        const inserted = [];
        for (const item of sopsArray) {
          const q = `INSERT INTO ${stepsTable} (no, sop_related, status, comment, reviewer)
                     VALUES ($1,$2,$3,$4,$5)
                     RETURNING id, no, sop_related, status, comment, reviewer`;
          const vals = [
            item.no ?? null,
            (item.sop_related ?? item.name ?? "").toString().trim(),
            item.status ?? "DRAFT",
            item.comment ?? "",
            item.reviewer ?? "",
          ];
          const r = await client.query(q, vals);
          inserted.push(r.rows[0]);
        }
        await client.query("COMMIT");
        return NextResponse.json({ success: true, inserted }, { status: 200 });
      } catch (dbErr) {
        await pool.query("ROLLBACK").catch(() => {});
        console.error(`DB error inserting ${stepsTable}:`, dbErr);
        return NextResponse.json({ success: false, error: "DB insert failed", details: String(dbErr) }, { status: 500 });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Unexpected error POST ${stepsTable}:`, err);
      return NextResponse.json({ success: false, error: "Unexpected server error", details: String(err) }, { status: 500 });
    }
  };

  return { GET, POST };
}

export function makeMetaHandlers({ metaTable, departmentName }) {
  const SELECT_COLUMNS = [
    "id",
    "department_name",
    "sop_status",
    "preparer_status",
    "preparer_name",
    "preparer_date",
    "reviewer_comment",
    "reviewer_status",
    "reviewer_name",
    "reviewer_date",
    "created_at",
    "updated_at",
  ].join(", ");

  const ensureTable = async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${metaTable} (
        id SERIAL PRIMARY KEY,
        department_name VARCHAR(255) DEFAULT '${departmentName.replace(/'/g, "''")}',
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
  };

  const GET = async (req) => {
    try {
      const client = await pool.connect();
      try {
        await ensureTable(client);

        const url = new URL(req?.url || "", "http://localhost");
        const yearParam = url.searchParams.get("year");
        const year = yearParam ? parseInt(yearParam, 10) : null;

        let r;
        if (!Number.isNaN(year) && year) {
          const from = new Date(year, 0, 1);
          const to = new Date(year + 1, 0, 1);
          r = await client.query(
            `SELECT ${SELECT_COLUMNS} FROM ${metaTable}
             WHERE created_at >= $1 AND created_at < $2
             ORDER BY id DESC LIMIT 10`,
            [from, to],
          );
        } else {
          r = await client.query(`SELECT ${SELECT_COLUMNS} FROM ${metaTable} ORDER BY id DESC LIMIT 10`);
        }
        return NextResponse.json({ success: true, rows: r.rows }, { status: 200 });
      } catch (dbErr) {
        console.error(`DB error SELECT ${metaTable}:`, dbErr);
        return NextResponse.json({ success: false, error: "DB select failed", details: String(dbErr) }, { status: 500 });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Connection error GET ${metaTable}:`, err);
      return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
    }
  };

  const POST = async (req) => {
    try {
      // Hanya editor SOP (user/reviewer/admin) yang boleh mengubah meta SOP (preparer/reviewer)
      const authError = await requireSopEditor();
      if (authError) return authError;

      const body = await req.json().catch(() => ({}));
      const {
        sop_status,
        preparer_status,
        preparer_name,
        preparer_date,
        reviewer_comment,
        reviewer_status,
        reviewer_name,
        reviewer_date,
      } = body || {};

      if (!sop_status && !preparer_status && !reviewer_status) {
        return NextResponse.json({ success: false, error: "Payload kosong. Sertakan minimal status." }, { status: 400 });
      }

      const client = await pool.connect();
      try {
        await ensureTable(client);
        const q = `
          INSERT INTO ${metaTable}
            (sop_status, preparer_status, preparer_name, preparer_date, reviewer_comment, reviewer_status, reviewer_name, reviewer_date, updated_at)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
          RETURNING ${SELECT_COLUMNS}
        `;
        const vals = [
          sop_status || null,
          preparer_status || null,
          preparer_name || null,
          preparer_date || null,
          reviewer_comment || null,
          reviewer_status || null,
          reviewer_name || null,
          reviewer_date || null,
        ];
        const r = await client.query(q, vals);
        return NextResponse.json({ success: true, inserted: r.rows[0] }, { status: 200 });
      } catch (dbErr) {
        console.error(`DB insert ${metaTable} failed:`, dbErr);
        return NextResponse.json({ success: false, error: "DB insert failed", details: String(dbErr) }, { status: 500 });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Unexpected error POST ${metaTable}:`, err);
      return NextResponse.json({ success: false, error: "Unexpected server error", details: String(err) }, { status: 500 });
    }
  };

  return { GET, POST };
}

export function makeAuditPeriodHandlers({ auditPeriodTable, departmentName }) {
  const SELECT_COLUMNS = ["id", "department_name", "audit_period_start", "audit_period_end", "created_at", "updated_at"].join(", ");

  const ensureTable = async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${auditPeriodTable} (
        id SERIAL PRIMARY KEY,
        department_name VARCHAR(255) DEFAULT '${departmentName.replace(/'/g, "''")}',
        audit_period_start DATE NOT NULL,
        audit_period_end DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  };

  const GET = async () => {
    try {
      const client = await pool.connect();
      try {
        // if table missing -> empty
        const check = await client.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=$1);`,
          [auditPeriodTable]
        );
        if (!check.rows?.[0]?.exists) {
          return NextResponse.json({ success: true, rows: [] }, { status: 200 });
        }
        const r = await client.query(`SELECT ${SELECT_COLUMNS} FROM ${auditPeriodTable} ORDER BY id DESC LIMIT 1`);
        return NextResponse.json({ success: true, rows: r.rows }, { status: 200 });
      } catch (dbErr) {
        console.error(`DB error SELECT ${auditPeriodTable}:`, dbErr);
        return NextResponse.json({ success: false, error: "DB select failed", details: String(dbErr) }, { status: 500 });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Connection error GET ${auditPeriodTable}:`, err);
      return NextResponse.json({ success: false, error: "Server error", details: String(err) }, { status: 500 });
    }
  };

  const POST = async (req) => {
    try {
      // Hanya editor SOP (user/reviewer/admin) yang boleh mengubah periode audit SOP
      const authError = await requireSopEditor();
      if (authError) return authError;

      const body = await req.json().catch(() => ({}));
      const { audit_period_start, audit_period_end } = body || {};

      if (!audit_period_start || !audit_period_end) {
        return NextResponse.json(
          { success: false, error: "Missing required fields: audit_period_start, audit_period_end" },
          { status: 400 }
        );
      }

      if (new Date(audit_period_start) > new Date(audit_period_end)) {
        return NextResponse.json({ success: false, error: "Start date must be before end date" }, { status: 400 });
      }

      const client = await pool.connect();
      try {
        await ensureTable(client);

        const checkQ = `SELECT id FROM ${auditPeriodTable} WHERE department_name = $1 LIMIT 1`;
        const checkR = await client.query(checkQ, [departmentName]);

        let result;
        if (checkR.rows.length > 0) {
          const updateQ = `
            UPDATE ${auditPeriodTable}
            SET audit_period_start = $1, audit_period_end = $2, updated_at = NOW()
            WHERE department_name = $3
            RETURNING ${SELECT_COLUMNS}
          `;
          const updateR = await client.query(updateQ, [audit_period_start, audit_period_end, departmentName]);
          result = updateR.rows[0];
        } else {
          const insertQ = `
            INSERT INTO ${auditPeriodTable} (department_name, audit_period_start, audit_period_end, updated_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING ${SELECT_COLUMNS}
          `;
          const insertR = await client.query(insertQ, [departmentName, audit_period_start, audit_period_end]);
          result = insertR.rows[0];
        }

        return NextResponse.json({ success: true, inserted: result }, { status: 200 });
      } catch (dbErr) {
        console.error(`DB insert/update ${auditPeriodTable} failed:`, dbErr);
        return NextResponse.json({ success: false, error: "DB insert/update failed", details: String(dbErr) }, { status: 500 });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Unexpected error POST ${auditPeriodTable}:`, err);
      return NextResponse.json({ success: false, error: "Unexpected server error", details: String(err) }, { status: 500 });
    }
  };

  return { GET, POST };
}


