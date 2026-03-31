import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@/generated/prisma";

const prisma = globalThis.prisma || new PrismaClient();
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

// Map audit-finding dept slug to Evidence/Worksheet department name (uppercase)
const deptToWorksheetEvidenceName = {
  accounting: "ACCOUNTING",
  finance: "FINANCE",
  hrd: "HRD",
  "g&a": "G&A",
  ga: "G&A",
  sdp: "DESIGN STORE PLANNER",
  tax: "TAX",
  "l&p": "SECURITY L&P",
  lp: "SECURITY L&P",
  mis: "MIS",
  merch: "MERCHANDISE",
  ops: "OPERATIONAL",
  whs: "WAREHOUSE",
};

/** 
 * Returns { worksheetHasFile, evidenceApCodesWithFile }.
 * - worksheetHasFile: apakah pernah ada file worksheet untuk department ini (dipakai hanya sebagai info tambahan).
 * - evidenceApCodesWithFile: SET ap_code yang SUDAH PUBLISH di Evidence (overall_status = COMPLETE + ada file).
 */
async function getWorksheetAndEvidenceFileStatus(dept) {
  const deptName = deptToWorksheetEvidenceName[dept];
  if (!deptName) return { worksheetHasFile: false, evidenceApCodesWithFile: new Set() };
  try {
    const [worksheetLatest, evidenceRows] = await Promise.all([
      prisma.worksheet_finance.findFirst({
        where: { department: deptName },
        orderBy: { created_at: "desc" },
        select: { file_path: true },
      }),
      prisma.evidence.findMany({
        where: {
          department: deptName,
          file_url: { not: null },
          overall_status: {
            equals: "COMPLETE",
            mode: "insensitive",
          },
        },
        select: { ap_code: true },
      }),
    ]);
    const worksheetHasFile = !!(worksheetLatest?.file_path && String(worksheetLatest.file_path).trim());
    const evidenceApCodesWithFile = new Set(
      (evidenceRows || [])
        .map((r) => (r.ap_code != null && String(r.ap_code).trim() !== "" ? String(r.ap_code).trim() : null))
        .filter(Boolean)
    );
    return { worksheetHasFile, evidenceApCodesWithFile };
  } catch (e) {
    console.warn(`[audit-finding/${dept}] getWorksheetAndEvidenceFileStatus error:`, e?.message);
    return { worksheetHasFile: false, evidenceApCodesWithFile: new Set() };
  }
}

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function toIntSafe(v, fallback) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

// Truncate string to max length
function truncateString(str, maxLength) {
  if (!str || str === null || str === undefined) return null;
  const s = String(str);
  if (s.length <= maxLength) return s;
  return s.substring(0, maxLength);
}

function getDelegate(dept) {
  const model = deptToModel[dept];
  if (!model) return null;
  return prisma[model];
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

// Helper to get audit-program parent model
function getAuditProgramParent(dept) {
  const mapping = {
    accounting: () => prisma.accounting,
    finance: () => prisma.finance,
    hrd: () => prisma.hrd,
    "g&a": () => prisma.general_affair,
    ga: () => prisma.general_affair,
    sdp: () => prisma.sdp,
    tax: () => prisma.tax,
    "l&p": () => prisma.lp,
    lp: () => prisma.lp,
    mis: () => prisma.mis,
    merch: () => prisma.merchandise,
    ops: () => prisma.operational,
    whs: () => prisma.warehouse,
  };
  const getter = mapping[dept];
  return getter ? getter() : null;
}

// Helper to get audit-program AP model
function getAuditProgramAp(dept) {
  const mapping = {
    accounting: () => prisma.AccountingAp,
    finance: () => prisma.FinanceAp,
    hrd: () => prisma.HrdAp,
    "g&a": () => prisma.GeneralAffairAp,
    ga: () => prisma.GeneralAffairAp,
    sdp: () => prisma.SdpAp,
    tax: () => prisma.TaxAp,
    "l&p": () => prisma.LpAp,
    lp: () => prisma.LpAp,
    mis: () => prisma.MisAp,
    merch: () => prisma.MerchandiseAp,
    ops: () => prisma.OperationalAp,
    whs: () => prisma.WarehouseAp,
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
          objective: ap.objective ?? null,
          procedures: ap.procedures ?? null,
          description: ap.description ?? null,
          application: ap.application ?? null,
          owners: parent?.owners ?? null,
        },
      ];
    })
  );
}

export async function GET(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    if (!delegate) return NextResponse.json({ error: "Invalid department" }, { status: 400 });

    const url = new URL(req.url);
    const page = Math.max(1, toIntSafe(url.searchParams.get("page"), 1));
    const pageSize = Math.max(1, Math.min(100, toIntSafe(url.searchParams.get("pageSize"), 50)));
    const skip = (page - 1) * pageSize;

    const includeCompleted =
      url.searchParams.get("include_completed") === "1" ||
      url.searchParams.get("include_completed") === "true";

    const yearParam = url.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : null;
    const hasValidYear = !Number.isNaN(year) && !!year;

    const whereFinding = {};
    if (!includeCompleted) {
      // Default behaviour (untuk layar kerja): sembunyikan finding yang sudah COMPLETED.
      whereFinding.NOT = {
        completion_status: {
          equals: "COMPLETED",
          mode: "insensitive",
        },
      };
    } else {
      // Untuk report / review (include_completed=1), kembalikan HANYA finding yang sudah COMPLETED
      whereFinding.completion_status = {
        equals: "COMPLETED",
        mode: "insensitive",
      };
    }

    let from = null;
    let to = null;
    if (hasValidYear) {
      from = new Date(year, 0, 1);
      to = new Date(year + 1, 0, 1);

      if (!includeCompleted) {
        // Layar kerja: filter tahun berdasarkan created_at.
        whereFinding.created_at = { gte: from, lt: to };
      } else {
        // Review/report: filter berdasarkan completion_date terlebih dulu.
        // Jika completion_date kosong, fallback ke updated_at lalu created_at.
        whereFinding.AND = [
          ...(Array.isArray(whereFinding.AND) ? whereFinding.AND : []),
          {
            OR: [
              { completion_date: { gte: from, lt: to } },
              {
                AND: [
                  { completion_date: null },
                  { updated_at: { gte: from, lt: to } },
                ],
              },
              {
                AND: [
                  { completion_date: null },
                  { updated_at: null },
                  { created_at: { gte: from, lt: to } },
                ],
              },
            ],
          },
        ];
      }
    }

    const apMapping = deptToAuditProgram[dept];
    // Jika include_completed=1, JANGAN lagi bergantung pada audit-program parents (karena setelah publish sudah dihapus).
    // Cukup pakai tabel audit_finding_* sebagai sumber data utama untuk report/review.
    if (includeCompleted || !apMapping) {
      const [findings, total] = await Promise.all([
        delegate.findMany({
          where: whereFinding,
          orderBy: { id: "desc" },
          skip,
          take: pageSize,
        }),
        delegate.count({ where: whereFinding }),
      ]);

      // For completed rows, prefer snapshot fields stored on finding.
      // If an older row does not have the snapshot yet and the source AP still exists,
      // enrich the response from audit-program/risk-assessment as a best-effort fallback.
      const snapshotMap =
        includeCompleted && apMapping
          ? await buildAuditProgramSnapshotMap(
              dept,
              findings.map((finding) => finding.ap_code)
            )
          : new Map();

      const enrichedFindings = findings.map((finding) => {
        const snapshot = snapshotMap.get(String(finding.ap_code ?? "").trim()) || null;
        return {
          ...finding,
          objective: finding.objective ?? snapshot?.objective ?? null,
          procedures: finding.procedures ?? snapshot?.procedures ?? null,
          description: finding.description ?? snapshot?.description ?? null,
          application: finding.application ?? snapshot?.application ?? null,
          owners: finding.owners ?? snapshot?.owners ?? null,
        };
      });

      return NextResponse.json({ data: enrichedFindings, meta: { total, page, pageSize } }, { status: 200 });
    }

    const apModel = getAuditProgramAp(dept);
    const parentModel = getAuditProgramParent(dept);
    if (!apModel || !parentModel) {
      const [findings, total] = await Promise.all([
        delegate.findMany({ where: whereFinding, orderBy: { id: "desc" }, skip, take: pageSize }),
        delegate.count({ where: whereFinding }),
      ]);
      return NextResponse.json({ data: findings, meta: { total, page, pageSize } }, { status: 200 });
    }

    // Finding workspace should only read published audit-program data.
    // Keep `null` as fallback for older rows that may not have status populated.
    const parentWhere = {
      OR: [
        { status: "published" },
        { status: null },
      ],
    };
    // Sama seperti di atas: hanya layar kerja yang dibatasi tahun di parent audit program.
    if (!includeCompleted && hasValidYear) {
      const pFrom = new Date(year, 0, 1);
      const pTo = new Date(year + 1, 0, 1);
      parentWhere.created_at = { gte: pFrom, lt: pTo };
    }

    const [parents, allFindings, completedFindings] = await Promise.all([
      parentModel.findMany({
        where: parentWhere,
        include: { aps: true },
        orderBy: { risk_id: "asc" },
      }),
      delegate.findMany({ where: whereFinding, orderBy: { id: "desc" } }),
      // Temukan semua finding yang sudah COMPLETED untuk menyembunyikannya dari layar kerja (kecuali include_completed=true)
      includeCompleted
        ? Promise.resolve([])
        : delegate.findMany({
            where: {
              completion_status: {
                equals: "COMPLETED",
                mode: "insensitive",
              },
            },
            select: { risk_id: true, ap_code: true },
          }),
    ]);

    const findingByKey = new Map();
    const findingByApCode = new Map();
    for (const f of allFindings) {
      const rId = (f.risk_id != null && f.risk_id !== "") ? String(f.risk_id).trim() : "";
      const ap = (f.ap_code != null && f.ap_code !== "") ? String(f.ap_code).trim() : "";
      const key = `${rId}::${ap}`;
      if (!findingByKey.has(key)) findingByKey.set(key, f);
      if (ap && !findingByApCode.has(ap)) findingByApCode.set(ap, f);
    }

    // Kumpulan AP yang sudah COMPLETED (supaya tidak muncul lagi di halaman Finding utama)
    const completedKeySet = new Set(
      (completedFindings || []).map((f) => {
        const rId = f.risk_id != null ? String(f.risk_id).trim() : "";
        const ap = f.ap_code != null ? String(f.ap_code).trim() : "";
        return `${rId}::${ap}`;
      }),
    );
    const completedApCodeSet = new Set(
      (completedFindings || [])
        .map((f) => (f.ap_code != null ? String(f.ap_code).trim() : ""))
        .filter(Boolean),
    );

    const { worksheetHasFile, evidenceApCodesWithFile } = await getWorksheetAndEvidenceFileStatus(dept);

    const auditProgramData = parents.flatMap((p) =>
      p.aps && p.aps.length > 0
        ? p.aps
            .map((ap) => {
              const riskId = p.risk_id_no ?? String(p.risk_id) ?? "";
              const apCode = ap.ap_code ?? "";
              const apCodeTrimmed = String(apCode).trim();
              const key = `${String(riskId).trim()}::${apCodeTrimmed}`;

              // Jika sudah COMPLETED dan kita tidak sedang include_completed, sembunyikan dari halaman kerja
              if (!includeCompleted && (completedKeySet.has(key) || completedApCodeSet.has(apCodeTrimmed))) {
                return null;
              }

              // Fallback ke ap_code saja jika risk_id berubah / kosong saat save,
              // supaya row yang sudah disimpan tetap ketemu lagi saat reload.
              const finding = findingByKey.get(key) || findingByApCode.get(apCodeTrimmed);
              const hasEvidenceFileForRow = evidenceApCodesWithFile.has(apCodeTrimmed);

              // Completion status dikontrol sistem:
              // - jika sudah publish => COMPLETED
              // - jika Evidence sudah COMPLETE => Ready to Publish
              // - selain itu => Draft
              const existingStatusRaw = (finding?.completion_status || "").toString().trim();
              const existingStatusUpper = existingStatusRaw.toUpperCase();
              let completionStatus;
              if (existingStatusUpper === "COMPLETED") {
                completionStatus = "COMPLETED";
              } else if (hasEvidenceFileForRow) {
                completionStatus = "Ready to Publish";
              } else {
                completionStatus = "Draft";
              }

              return {
                id: finding?.id ?? null,
                risk_id: p.risk_id_no ?? String(p.risk_id) ?? null,
                risk_description: finding?.risk_description ?? p.risk_description ?? null,
                risk_details: finding?.risk_details ?? p.risk_details ?? null,
                impact_description: p.impact_description ?? null,
                ap_code: ap.ap_code ?? null,
                substantive_test: ap.substantive_test ?? null,
                risk: finding?.risk ?? null,
                check_yn: finding?.check_yn ?? null,
                method: finding?.method ?? ap.method ?? null,
                preparer: finding?.preparer ?? null,
                finding_result: finding?.finding_result ?? null,
                finding_description: finding?.finding_description ?? null,
                recommendation: finding?.recommendation ?? null,
                auditee: finding?.auditee ?? null,
                completion_status: completionStatus,
                completion_date: finding?.completion_date ?? null,
                created_at: finding?.created_at ?? null,
                updated_at: finding?.updated_at ?? null,
                objective: finding?.objective ?? ap.objective ?? null,
                procedures: finding?.procedures ?? ap.procedures ?? null,
                description: finding?.description ?? ap.description ?? null,
                application: finding?.application ?? ap.application ?? null,
                owners: finding?.owners ?? p.owners ?? null,
              };
            })
            .filter(Boolean)
        : [
            {
              id: null,
              risk_id: p.risk_id_no ?? String(p.risk_id) ?? null,
              risk_description: p.risk_description ?? null,
              risk_details: p.risk_details ?? null,
              impact_description: p.impact_description ?? null,
              ap_code: null,
              substantive_test: null,
              risk: null,
              check_yn: null,
              method: null,
              preparer: null,
              finding_result: null,
              finding_description: null,
              recommendation: null,
              auditee: null,
              completion_status: "Draft",
              completion_date: null,
              created_at: null,
              updated_at: null,
              objective: null,
              procedures: null,
              description: null,
              application: null,
              owners: p.owners ?? null,
            },
          ]
    );

    const total = auditProgramData.length;
    const dataWithStatus = auditProgramData.slice(skip, skip + pageSize);

    return NextResponse.json({ data: dataWithStatus, meta: { total, page, pageSize } }, { status: 200 });
  } catch (err) {
    console.error(`GET /api/audit-finding/[dept] error:`, err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    if (!delegate) return NextResponse.json({ error: "Invalid department" }, { status: 400 });

    const body = await req.json();
    const createData = {
      risk_id: truncateString(body.riskId, 50),
      risk_description: body.riskDescription ?? null,
      risk_details: body.riskDetails ?? null,
      ap_code: truncateString(body.apCode, 50),
      substantive_test: body.substantiveTest ?? null,
      risk: toIntOrNull(body.risk),
      check_yn: truncateString(body.checkYN, 10),
      method: truncateString(body.method, 100),
      preparer: truncateString(body.preparer, 255),
      finding_result: truncateString(body.findingResult, 100),
      finding_description: body.findingDescription ?? null,
      recommendation: body.recommendation ?? null,
      auditee: truncateString(body.auditee, 255),
      completion_status: truncateString(body.completionStatus, 50),
      completion_date: body.completionDate ? new Date(body.completionDate) : null,
    };

    if (supportsFindingSnapshotFields(dept)) {
      createData.objective = body.objective ?? null;
      createData.procedures = body.procedures ?? null;
      createData.description = body.description ?? null;
      createData.application = body.application ?? null;
      createData.owners = truncateString(body.owners, 35);
    }

    const created = await delegate.create({
      data: createData,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error(`POST /api/audit-finding/[dept] error:`, err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}


