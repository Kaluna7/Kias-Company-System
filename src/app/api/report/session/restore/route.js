export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { restoreSharedReportFromBackup } from "@/app/lib/report/restoreSharedReport";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/** POST /api/report/session/restore { year: 2026, backupSessionId?: "..." } */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body.year);
    if (!year) {
      return NextResponse.json({ success: false, error: "Invalid year" }, { status: 400 });
    }

    const result = await restoreSharedReportFromBackup(year, {
      backupSessionId: body.backupSessionId,
      updatedBy: session.user.email || session.user.name || "restore",
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("POST /api/report/session/restore:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
