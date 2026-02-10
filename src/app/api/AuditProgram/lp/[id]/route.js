import prisma from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const id = parseInt(p?.id || 0);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid lp risk_id" }, { status: 400 });
    }

    // Delete related APs first (cascade)
    await prisma.lpAp.deleteMany({
      where: { lp_risk_id: id },
    });

    // Delete the parent record
    await prisma.lp.delete({
      where: { risk_id: id },
    });

    return NextResponse.json({ message: "L&P record deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/AuditProgram/lp/[id] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

