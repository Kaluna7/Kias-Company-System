import prisma from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  try {
    const p = await Promise.resolve(params);
    const id = parseInt(p?.id || 0);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid mis risk_id" }, { status: 400 });
    }

    // Delete related APs first (cascade)
    await prisma.misAp.deleteMany({
      where: { mis_risk_id: id },
    });

    // Delete the parent record
    await prisma.mis.delete({
      where: { risk_id: id },
    });

    return NextResponse.json({ message: "MIS record deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/AuditProgram/mis/[id] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

