export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  readReportFindingsByDept,
  upsertReportFindings,
} from "@/app/lib/report/reportFindingsStore";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/** GET /api/report/findings?year=2026 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url || "", "http://localhost");
    const year = parseYear(searchParams.get("year"));
    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }

    const byDept = await readReportFindingsByDept(year);
    const findings = Object.entries(byDept).map(([department, row]) => ({
      department,
      findingHtml: row.findingHtml,
      recommendationHtml: row.recommendationHtml,
    }));

    return NextResponse.json(
      { success: true, year, byDept, findings },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("GET /api/report/findings:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

/** POST /api/report/findings  { year, findings: [{ department, findingHtml, recommendationHtml }] } */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body.year);
    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }

    const rows = Array.isArray(body.findings) ? body.findings : [];
    const user = session.user.email || session.user.name || session.user.id || "user";
    await upsertReportFindings(year, rows, user);

    const byDept = await readReportFindingsByDept(year);
    return NextResponse.json({ success: true, year, byDept });
  } catch (err) {
    console.error("POST /api/report/findings:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
