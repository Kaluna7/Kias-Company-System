import prisma from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const id = parseInt(p?.id || 0);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid merchandise risk_id" }, { status: 400 });
    }

    // Delete related APs first (cascade)
    await prisma.merchandiseAp.deleteMany({
      where: { merchandise_risk_id: id },
    });

    // Delete the parent record
    await prisma.merchandise.delete({
      where: { risk_id: id },
    });

    return NextResponse.json({ message: "Merchandise record deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/AuditProgram/merch/[id] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

