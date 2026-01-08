import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// GET: Fetch single audit finding by ID
export async function GET(req, { params }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const finding = await prisma.audit_finding_accounting.findUnique({
      where: { id },
    });

    if (!finding) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    return NextResponse.json({ data: finding }, { status: 200 });
  } catch (err) {
    console.error("GET /api/audit-finding/accounting/[id] error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}

// PUT: Update audit finding
export async function PUT(req, { params }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();

    const updated = await prisma.audit_finding_accounting.update({
      where: { id },
      data: {
        risk_id: body.riskId ?? undefined,
        risk_description: body.riskDescription ?? undefined,
        risk_details: body.riskDetails ?? undefined,
        ap_code: body.apCode ?? undefined,
        substantive_test: body.substantiveTest ?? undefined,
        risk: body.risk !== undefined ? toIntOrNull(body.risk) : undefined,
        check_yn: body.checkYN ?? undefined,
        method: body.method ?? undefined,
        preparer: body.preparer ?? undefined,
        finding_result: body.findingResult ?? undefined,
        finding_description: body.findingDescription ?? undefined,
        recommendation: body.recommendation ?? undefined,
        auditee: body.auditee ?? undefined,
        completion_status: body.completionStatus ?? undefined,
        completion_date: body.completionDate ? new Date(body.completionDate) : undefined,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/audit-finding/accounting/[id] error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete audit finding
export async function DELETE(req, { params }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await prisma.audit_finding_accounting.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Finding deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/audit-finding/accounting/[id] error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}

