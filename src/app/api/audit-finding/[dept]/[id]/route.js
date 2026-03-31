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

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
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

export async function GET(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    if (!delegate) return NextResponse.json({ error: "Invalid department" }, { status: 400 });

    const id = parseInt(p?.id);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const finding = await delegate.findUnique({ where: { id } });
    if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

    return NextResponse.json({ data: finding }, { status: 200 });
  } catch (err) {
    console.error(`GET /api/audit-finding/[dept]/[id] error:`, err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    if (!delegate) return NextResponse.json({ error: "Invalid department" }, { status: 400 });

    const id = parseInt(p?.id);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();

    const updateData = {
      risk_id: body.riskId !== undefined ? truncateString(body.riskId, 50) : undefined,
      risk_description: body.riskDescription ?? undefined,
      risk_details: body.riskDetails ?? undefined,
      ap_code: body.apCode !== undefined ? truncateString(body.apCode, 50) : undefined,
      substantive_test: body.substantiveTest ?? undefined,
      risk: body.risk !== undefined ? toIntOrNull(body.risk) : undefined,
      check_yn: body.checkYN !== undefined ? truncateString(body.checkYN, 10) : undefined,
      method: body.method !== undefined ? truncateString(body.method, 100) : undefined,
      preparer: body.preparer !== undefined ? truncateString(body.preparer, 255) : undefined,
      finding_result: body.findingResult !== undefined ? truncateString(body.findingResult, 100) : undefined,
      finding_description: body.findingDescription ?? undefined,
      recommendation: body.recommendation ?? undefined,
      auditee: body.auditee !== undefined ? truncateString(body.auditee, 255) : undefined,
      completion_status: body.completionStatus !== undefined ? truncateString(body.completionStatus, 50) : undefined,
      completion_date: body.completionDate ? new Date(body.completionDate) : undefined,
      updated_at: new Date(),
    };

    if (supportsFindingSnapshotFields(dept)) {
      updateData.objective = body.objective ?? undefined;
      updateData.procedures = body.procedures ?? undefined;
      updateData.description = body.description ?? undefined;
      updateData.application = body.application ?? undefined;
      updateData.owners = body.owners !== undefined ? truncateString(body.owners, 35) : undefined;
    }

    const updated = await delegate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err) {
    console.error(`PUT /api/audit-finding/[dept]/[id] error:`, err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const dept = p?.dept;
    const delegate = getDelegate(dept);
    if (!delegate) return NextResponse.json({ error: "Invalid department" }, { status: 400 });

    const id = parseInt(p?.id);
    if (Number.isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await delegate.delete({ where: { id } });
    return NextResponse.json({ message: "Finding deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error(`DELETE /api/audit-finding/[dept]/[id] error:`, err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}


