import prisma from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(req, { params }) {
  try {
    const id = Number(params?.id || 0);
    if (!id) {
      return NextResponse.json({ error: "Invalid general_affair risk_id" }, { status: 400 });
    }

    const updated = await prisma.general_affair.update({
      where: { risk_id: id },
      data: { status: "draft" },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("PUT /api/AuditProgram/ga/[id]/draft error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}

