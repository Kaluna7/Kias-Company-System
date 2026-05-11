import { PrismaClient } from "@/generated/prisma";
import { assignDerivedRiskPriorityToBody } from "../../_shared/riskPriorityPut";
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isInteger(v) ? v : Math.trunc(v);
  const n = parseInt(String(v).trim(), 10);
  return Number.isNaN(n) ? null : n;
}

export async function PUT(req, { params }) {
  try {
    const id = parseInt((await params).id, 10);
    const body = await req.json();
    delete body.risk_id;
    delete body.risk_id_no;

    const existing = await prisma.sdp.findUnique({ where: { risk_id: id } });
    if (!existing) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }
    assignDerivedRiskPriorityToBody(body, existing);

    const numericFields = [
      "impact_level",
      "probability_level",
      "priority_level",
    ];

    for (const nf of numericFields) {
      if (nf in body) {
        body[nf] = toIntOrNull(body[nf]);
      }
    }

    const updated = await prisma.sdp.update({
      where: { risk_id: id },
      data: body,
    });

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (err) {
    console.error("PUT /api/sdp/[id] error:", err);
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
    await prisma.sdpAp.deleteMany({
      where: { sdp_risk_id: id },
    });

    // Delete the parent record
    await prisma.sdp.delete({
      where: { risk_id: id },
    });

    return new Response(JSON.stringify({ message: "SDP record deleted successfully" }), { status: 200 });
  } catch (err) {
    console.error("DELETE /api/RiskAssessment/sdp/[id] error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Server error" }), { status: 500 });
  }
}