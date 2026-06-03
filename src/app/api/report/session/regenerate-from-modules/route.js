export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readMeta } from "@/app/lib/report/documentStore";
import { readReportState } from "@/app/lib/report/reportStateStore";
import { createReportSession } from "@/app/lib/report/reportService";
import { isOnlyOfficeEnabled } from "@/app/lib/report/onlyoffice/jwt";
import {
  buildModuleSyncRegeneratePayload,
  sharedReportSessionId,
} from "@/app/lib/report/onlyOfficeDocxGuard";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * Rebuild shared DOCX from DB report state (module tables + OnlyOffice narrative).
 * POST /api/report/session/regenerate-from-modules  { year: 2025 }
 */
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

    const saved = (await readReportState(year)) || {};
    const findingSections = Array.isArray(saved.findingSections) ? saved.findingSections : [];
    if (findingSections.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No report data for this year. Open HTML preview first.",
        },
        { status: 400 },
      );
    }

    const sessionId = sharedReportSessionId(year);
    const payload = await buildModuleSyncRegeneratePayload(year);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Could not build regenerate payload" },
        { status: 500 },
      );
    }

    const result = await createReportSession(
      payload,
      {
        id: session.user.id || session.user.email,
        name: session.user.name || session.user.email,
        email: session.user.email,
      },
      { sessionId, regenerateDocx: true },
    );

    const meta = await readMeta(sessionId);

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      year: result.year,
      editorPath: result.editorPath,
      moduleTablesHash: meta?.moduleTablesHash ?? payload.moduleTablesHash,
      previewSnapshotHash: meta?.previewSnapshotHash ?? payload.previewSnapshotHash,
      regenerated: true,
      editorEnabled: result.editorEnabled ?? isOnlyOfficeEnabled(),
    });
  } catch (err) {
    console.error("POST regenerate-from-modules:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
