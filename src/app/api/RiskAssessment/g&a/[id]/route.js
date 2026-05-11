import { PrismaClient } from "@/generated/prisma";
import { assignDerivedRiskPriorityToBody } from "../../_shared/riskPriorityPut";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export async function PUT(req, { params }) {
  try {
    const id = parseInt((await params).id, 10);
    const body = await req.json();
    delete body.risk_id;
    delete body.risk_id_no;

    const existing = await prisma.general_affair.findUnique({ where: { risk_id: id } });
    if (!existing) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }
    assignDerivedRiskPriorityToBody(body, existing);

    const updated = await prisma.general_affair.update({
      where: { risk_id: id },
      data: body,
    });

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (err) {
    console.error("PUT /api/g&a/[id] error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Server error" }), { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const id = parseInt((await params).id, 10);
    if (!id || Number.isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400 });
    }

    // Delete related APs first (cascade)
    await prisma.generalAffairAp.deleteMany({
      where: { general_affair_risk_id: id },
    });

    // Delete the parent record
    await prisma.general_affair.delete({
      where: { risk_id: id },
    });

    return new Response(JSON.stringify({ message: "General Affair record deleted successfully" }), { status: 200 });
  } catch (err) {
    console.error("DELETE /api/RiskAssessment/g&a/[id] error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Server error" }), { status: 500 });
  }
}