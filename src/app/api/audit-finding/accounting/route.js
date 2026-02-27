import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

const WORKSHEET_EVIDENCE_DEPT = "ACCOUNTING";

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/** Per-row: Ready to Publish only when THIS row has evidence file + worksheet has file. */
async function getWorksheetAndEvidenceFileStatus() {
  try {
    const [worksheetLatest, evidenceRows] = await Promise.all([
      prisma.worksheet_finance.findFirst({
        where: { department: WORKSHEET_EVIDENCE_DEPT },
        orderBy: { created_at: "desc" },
        select: { file_path: true },
      }),
      prisma.evidence.findMany({
        where: { department: WORKSHEET_EVIDENCE_DEPT, file_url: { not: null } },
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
    return { worksheetHasFile: false, evidenceApCodesWithFile: new Set() };
  }
}

// GET: Same as [dept] — list from audit program (published), merge with findings; completion_status from worksheet/evidence
export async function GET() {
  try {
    const [parents, allFindings] = await Promise.all([
      prisma.accounting.findMany({
        where: { status: "published" },
        include: { aps: true },
        orderBy: { risk_id: "asc" },
      }),
      prisma.audit_finding_accounting.findMany({
        where: {
          NOT: { completion_status: { equals: "COMPLETED", mode: "insensitive" } },
        },
        orderBy: { id: "desc" },
      }),
    ]);

    const findingByKey = new Map();
    for (const f of allFindings) {
      const rId = (f.risk_id != null && f.risk_id !== "") ? String(f.risk_id).trim() : "";
      const ap = (f.ap_code != null && f.ap_code !== "") ? String(f.ap_code).trim() : "";
      const key = `${rId}::${ap}`;
      if (!findingByKey.has(key)) findingByKey.set(key, f);
    }

    const { worksheetHasFile, evidenceApCodesWithFile } = await getWorksheetAndEvidenceFileStatus();

    const auditProgramData = parents.flatMap((p) =>
      p.aps && p.aps.length > 0
        ? p.aps.map((ap) => {
            const riskId = p.risk_id_no ?? String(p.risk_id) ?? "";
            const apCode = ap.ap_code ?? "";
            const apCodeTrimmed = String(apCode).trim();
            const key = `${String(riskId).trim()}::${apCodeTrimmed}`;
            const finding = findingByKey.get(key);
            const hasEvidenceFileForRow = evidenceApCodesWithFile.has(apCodeTrimmed);
            const completionStatus = !hasEvidenceFileForRow ? "Draft" : (worksheetHasFile ? "Ready to Publish" : "Draft");
            return {
              id: finding?.id ?? null,
              risk_id: p.risk_id_no ?? String(p.risk_id) ?? null,
              risk_description: p.risk_description ?? null,
              risk_details: p.risk_details ?? null,
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
              objective: ap.objective ?? null,
              procedures: ap.procedures ?? null,
              description: ap.description ?? null,
              application: ap.application ?? null,
              owners: p.owners ?? null,
            };
          })
        : [
            {
              id: null,
              risk_id: p.risk_id_no ?? String(p.risk_id) ?? null,
              risk_description: p.risk_description ?? null,
              risk_details: p.risk_details ?? null,
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
    return NextResponse.json({ data: auditProgramData, meta: { total, page: 1, pageSize: total } }, { status: 200 });
  } catch (err) {
    console.error("GET /api/audit-finding/accounting error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}

// POST: Create new audit finding
export async function POST(req) {
  try {
    const body = await req.json();

    const created = await prisma.audit_finding_accounting.create({
      data: {
        risk_id: body.riskId ?? null,
        risk_description: body.riskDescription ?? null,
        risk_details: body.riskDetails ?? null,
        ap_code: body.apCode ?? null,
        substantive_test: body.substantiveTest ?? null,
        risk: toIntOrNull(body.risk),
        check_yn: body.checkYN ?? null,
        method: body.method ?? null,
        preparer: body.preparer ?? null,
        finding_result: body.findingResult ?? null,
        finding_description: body.findingDescription ?? null,
        recommendation: body.recommendation ?? null,
        auditee: body.auditee ?? null,
        completion_status: body.completionStatus ?? null,
        completion_date: body.completionDate ? new Date(body.completionDate) : null,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/audit-finding/accounting error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}

