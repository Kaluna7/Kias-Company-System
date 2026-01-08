import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// GET: Fetch all audit findings for accounting
export async function GET() {
  try {
    const findings = await prisma.audit_finding_accounting.findMany({
      orderBy: { id: "desc" },
    });
    return NextResponse.json({ data: findings }, { status: 200 });
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

