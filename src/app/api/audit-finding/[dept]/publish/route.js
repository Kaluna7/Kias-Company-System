import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@/generated/prisma";
import { pool } from "@/app/api/SopReview/_shared/pool";
import { isAuditFindingCheckYes } from "@/lib/auditFindingCheckYn";

const prisma = globalThis.prisma || new PrismaClient();

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

/** schedule_module_feedback.department_id for audit-finding module */
const SCHEDULE_ID_BY_DEPT = {
  finance: "A1.1",
  accounting: "A1.2",
  hrd: "A1.3",
  "g&a": "A1.4",
  ga: "A1.4",
  sdp: "A1.5",
  tax: "A1.6",
  "l&p": "A1.7",
  lp: "A1.7",
  mis: "A1.8",
  merch: "A1.9",
  ops: "A1.10",
  whs: "A1.11",
};

/** Normalize to UTC midnight date for @db.Date fields */
function toDateAtUtcMidnight(d) {
  if (d == null) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
}

async function loadConfiguredAuditFindingSchedule(deptRaw) {
  const key = String(deptRaw || "").toLowerCase();
  const deptId = SCHEDULE_ID_BY_DEPT[key];
  if (!deptId) return null;
  const client = await pool.connect();
  try {
    const reg = await client.query("SELECT to_regclass($1) AS t", ["public.schedule_module_feedback"]);
    if (!reg?.rows?.[0]?.t) return null;
    let r = await client.query(
      `SELECT start_date::date AS start_date, end_date::date AS end_date
       FROM public.schedule_module_feedback
       WHERE module_key = 'audit-finding' AND department_id = $1 AND is_configured = true
       ORDER BY updated_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [deptId],
    );
    let row = r.rows?.[0];
    if (!row?.start_date || !row?.end_date) {
      r = await client.query(
        `SELECT start_date::date AS start_date, end_date::date AS end_date
         FROM public.schedule_module_feedback
         WHERE module_key = 'audit-finding' AND department_id = $1
           AND start_date IS NOT NULL AND end_date IS NOT NULL
         ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, id DESC
         LIMIT 1`,
        [deptId],
      );
      row = r.rows?.[0];
    }
    if (!row?.start_date || !row?.end_date) return null;
    return { start: row.start_date, end: row.end_date };
  } catch (e) {
    console.warn("loadConfiguredAuditFindingSchedule:", e?.message);
    return null;
  } finally {
    client.release();
  }
}

function qIdent(name) {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return name;
}

function isHeaderStatusComplete(value) {
  const s = String(value ?? "").trim().toUpperCase();
  return s === "COMPLETED" || s === "COMPLETE";
}
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

const deptToModel = {
  accounting: "audit_finding_accounting",
  finance: "audit_finding_finance",
  hrd: "audit_finding_hrd",
  "g&a": "audit_finding_ga",
  ga: "audit_finding_ga",
  sdp: "audit_finding_sdp",
  tax: "audit_finding_tax",
  "l&p": "audit_finding_lp",
  lp: "audit_finding_lp",
  mis: "audit_finding_mis",
  merch: "audit_finding_merch",
  ops: "audit_finding_ops",
  whs: "audit_finding_whs",
};

// Map department to audit-program parent model, AP model, and relation name
const deptToAuditProgram = {
  accounting: { parent: "accounting", ap: "AccountingAp", relation: "accounting" },
  finance: { parent: "finance", ap: "FinanceAp", relation: "finance" },
  hrd: { parent: "hrd", ap: "HrdAp", relation: "hrd" },
  "g&a": { parent: "general_affair", ap: "GeneralAffairAp", relation: "general_affair" },
  ga: { parent: "general_affair", ap: "GeneralAffairAp", relation: "general_affair" },
  sdp: { parent: "sdp", ap: "SdpAp", relation: "sdp" },
  tax: { parent: "tax", ap: "TaxAp", relation: "tax" },
  "l&p": { parent: "lp", ap: "LpAp", relation: "lp" },
  lp: { parent: "lp", ap: "LpAp", relation: "lp" },
  mis: { parent: "mis", ap: "MisAp", relation: "mis" },
  merch: { parent: "merchandise", ap: "MerchandiseAp", relation: "merchandise" },
  ops: { parent: "operational", ap: "OperationalAp", relation: "operational" },
  whs: { parent: "warehouse", ap: "WarehouseAp", relation: "warehouse" },
};

function getDelegate(dept) {
  const model = deptToModel[dept];
  if (!model) return null;
  return prisma[model];
}

function parseSelectedYear(req) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : null;
  return !Number.isNaN(year) && year ? year : null;
}

function alignDateToSelectedYear(dateValue, selectedYear) {
  const date = new Date(dateValue);
  if (!selectedYear || Number.isNaN(date.getTime())) return date;
  date.setFullYear(selectedYear);
  return date;
}

function supportsFindingSnapshotFields(dept) {
  const modelName = deptToModel[dept];
  const model = Prisma.dmmf.datamodel.models.find((item) => item.name === modelName);
  if (!model) return false;
  const fieldNames = new Set(model.fields.map((field) => field.name));
  return ["objective", "procedures", "description", "application", "owners"].every((field) =>
    fieldNames.has(field)
  );
}

// Helper to get audit-program AP model
function getAuditProgramAp(dept) {
  const mapping = {
    accounting: () => prisma.accountingAp,
    finance: () => prisma.financeAp,
    hrd: () => prisma.hrdAp,
    "g&a": () => prisma.generalAffairAp,
    ga: () => prisma.generalAffairAp,
    sdp: () => prisma.sdpAp,
    tax: () => prisma.taxAp,
    "l&p": () => prisma.lpAp,
    lp: () => prisma.lpAp,
    mis: () => prisma.misAp,
    merch: () => prisma.merchandiseAp,
    ops: () => prisma.operationalAp,
    whs: () => prisma.warehouseAp,
  };
  const getter = mapping[dept];
  return getter ? getter() : null;
}

async function buildAuditProgramSnapshotMap(dept, apCodes = []) {
  const mapping = deptToAuditProgram[dept];
  const apModel = mapping ? getAuditProgramAp(dept) : null;
  if (!mapping || !apModel || !Array.isArray(apCodes) || apCodes.length === 0) {
    return new Map();
  }

  const normalizedCodes = Array.from(
    new Set(
      apCodes
        .map((code) => (code != null ? String(code).trim() : ""))
        .filter(Boolean)
    )
  );

  if (normalizedCodes.length === 0) return new Map();

  const aps = await apModel.findMany({
    where: { ap_code: { in: normalizedCodes } },
    include: {
      [mapping.relation]: true,
    },
  });

  return new Map(
    aps.map((ap) => {
      const parent = ap?.[mapping.relation] ?? null;
      return [
        String(ap.ap_code).trim(),
        {
          risk_id:
            parent?.risk_id_no != null && String(parent.risk_id_no).trim() !== ""
              ? String(parent.risk_id_no).trim()
              : parent?.risk_id != null
                ? String(parent.risk_id)
                : null,
          risk_description: parent?.risk_description ?? null,
          risk_details: parent?.risk_details ?? null,
          substantive_test: ap?.substantive_test ?? null,
          objective: ap?.objective ?? null,
          procedures: ap?.procedures ?? null,
          description: ap?.description ?? null,
          application: ap?.application ?? null,
          method: ap?.method ?? null,
          owners: parent?.owners ?? null,
        },
      ];
    })
  );
}

// Publish findings for a department:
// - Baris dengan CHECK (Y/N) = Yes dan belum COMPLETED dipublikasikan ke Audit Review.
// - Snapshot dari Audit Program tetap disimpan seperti sebelumnya.
export async function PUT(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    const selectedYear = parseSelectedYear(req);
    
    if (!delegate) {
      return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    const slug = deptToSlug[dept?.toLowerCase()];
    if (slug) {
      const metaTable = qIdent(`audit_finding_meta_${slug}`);
      const metaClient = await pool.connect();
      try {
        // Sama seperti GET /meta tanpa year: baris terbaru saja. POST meta memakai INSERT dengan
        // created_at = NOW(); filter tahun audit di sini membuat baris baru (tahun kalender berbeda
        // dari ?year=...) tidak ketemu → false 403 walau UI sudah COMPLETE.
        const metaRes = await metaClient.query(
          `SELECT preparer_status, final_status FROM ${metaTable}
           ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`,
        );
        const metaRow = metaRes.rows?.[0];
        const prep = metaRow?.preparer_status;
        const fin = metaRow?.final_status;
        if (!isHeaderStatusComplete(prep) || !isHeaderStatusComplete(fin)) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Publish requires both Preparer Status and Final Status to be COMPLETE. Save the header on Audit Finding first.",
            },
            { status: 403 },
          );
        }
      } finally {
        metaClient.release();
      }
    }

    const candidatesWhere = {
      NOT: {
        completion_status: {
          equals: "COMPLETED",
          mode: "insensitive",
        },
      },
    };
    if (selectedYear) {
      candidatesWhere.created_at = {
        gte: new Date(selectedYear, 0, 1),
        lt: new Date(selectedYear + 1, 0, 1),
      };
    }
    const candidates = await delegate.findMany({
      where: candidatesWhere,
    });
    const readyFindings = (candidates || []).filter((f) => isAuditFindingCheckYes(f.check_yn));

    if (readyFindings.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: `No findings with CHECK (Y/N) = Yes to publish for ${dept}. Set CHECK to Yes in Audit Finding first.`,
          count: 0,
        },
        { status: 200 },
      );
    }

    const readyApCodes = new Set(
      readyFindings
        .map((f) => (f.ap_code != null ? String(f.ap_code).trim() : ""))
        .filter(Boolean),
    );

    const snapshotMap = await buildAuditProgramSnapshotMap(dept, Array.from(readyApCodes));
    const publishTimestamp = alignDateToSelectedYear(new Date(), selectedYear);
    const canPersistSnapshot = supportsFindingSnapshotFields(dept);

    const scheduleSnap = await loadConfiguredAuditFindingSchedule(dept);
    const snapPeriodStart = scheduleSnap?.start ? toDateAtUtcMidnight(scheduleSnap.start) : null;
    const snapPeriodEnd = scheduleSnap?.end ? toDateAtUtcMidnight(scheduleSnap.end) : null;
    const snapFieldworkEnd = toDateAtUtcMidnight(publishTimestamp);

    // Update findings: set completion_status to COMPLETED dan simpan snapshot
    // dari audit-program / risk-assessment sebelum source dihapus.
    for (const finding of readyFindings) {
      const snapshot = snapshotMap.get(String(finding.ap_code ?? "").trim()) || null;

      const updateData = {
        risk_id: finding.risk_id ?? snapshot?.risk_id ?? undefined,
        risk_description: finding.risk_description ?? snapshot?.risk_description ?? undefined,
        risk_details: finding.risk_details ?? snapshot?.risk_details ?? undefined,
        substantive_test: finding.substantive_test ?? snapshot?.substantive_test ?? undefined,
        method: finding.method ?? snapshot?.method ?? undefined,
        completion_status: "COMPLETED",
        completion_date: finding.completion_date ?? publishTimestamp,
        updated_at: publishTimestamp,
        report_audit_period_start: snapPeriodStart,
        report_audit_period_end: snapPeriodEnd,
        report_audit_fieldwork_start: snapPeriodStart,
        report_audit_fieldwork_end: snapFieldworkEnd,
      };

      if (canPersistSnapshot) {
        updateData.objective = snapshot?.objective ?? undefined;
        updateData.procedures = snapshot?.procedures ?? undefined;
        updateData.description = snapshot?.description ?? undefined;
        updateData.application = snapshot?.application ?? undefined;
        updateData.owners = snapshot?.owners ?? undefined;
      }

      await delegate.update({
        where: { id: finding.id },
        data: updateData,
      });
    }

    // Keep risk assessment and audit program source data after publish so only finding and evidence leave the workspace flow.

    // Reset all meta after publish: status and finding result/file so form is clean
    if (slug) {
      try {
        const metaTable = qIdent(`audit_finding_meta_${slug}`);
        const client = await pool.connect();
        try {
          await client.query(
            `UPDATE ${metaTable} SET preparer_status = NULL, final_status = NULL, finding_result = NULL, finding_result_file_name = NULL, prepare = NULL, prepare_date = NULL, review = NULL, review_date = NULL, updated_at = NOW()`
          );
        } finally {
          client.release();
        }
      } catch (metaErr) {
        console.warn(`Publish: could not reset meta for ${dept}:`, metaErr.message);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Published ${readyFindings.length} finding(s) for ${dept} (CHECK (Y/N) = Yes).`,
        count: readyFindings.length,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(`PUT /api/audit-finding/[dept]/publish error:`, err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

