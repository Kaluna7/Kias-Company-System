import { NextResponse } from "next/server";
import {
  deleteAuditProgramApAndRenumber,
  getAuditProgramDepartment,
} from "@/app/lib/auditProgramAp";

export async function DELETE(req, { params }) {
  try {
    const resolved = await Promise.resolve(params);
    const dept = String(resolved?.dept ?? "").trim().toLowerCase();
    const apId = parseInt(resolved?.apId || 0, 10);

    if (!getAuditProgramDepartment(dept)) {
      return NextResponse.json({ error: `Unknown department: ${dept}` }, { status: 400 });
    }
    if (!apId || Number.isNaN(apId)) {
      return NextResponse.json({ error: "Invalid ap_id" }, { status: 400 });
    }

    const result = await deleteAuditProgramApAndRenumber(dept, apId);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/AuditProgram/[dept]/ap/[apId] error:", err);
    const message = String(err?.message || err);
    const status = message.includes("not found") ? 404 : message.includes("draft") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
