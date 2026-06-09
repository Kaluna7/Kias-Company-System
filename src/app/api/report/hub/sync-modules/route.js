export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readMeta, writeMeta } from "@/app/lib/report/documentStore";
import { savePreviewPayload } from "@/app/lib/report/previewPayloadStore";
import { computeModuleTablesHash } from "@/app/lib/report/moduleTablesHash";
import { pickNarrativeFromReportState } from "@/app/lib/report/reportStateNarrative";
import { computePreviewSnapshotHash } from "@/app/lib/report/previewAuditVisibility";
import { getHubRevision, HUB_CHANGE_SOURCE } from "@/app/lib/report/reportPreviewHub";
import { broadcastReportStateChange } from "@/app/lib/report/reportStateHub";
import { refreshHubModulesForRegen } from "@/app/lib/report/refreshHubModulesForRegen";
import { sharedReportSessionId } from "@/app/lib/report/onlyOfficeDocxGuard";

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

/**
 * Pull latest SOP/Audit rows into hub DB + bootstrap lock/unlock sync.
 * POST /api/report/hub/sync-modules  { year: 2025 }
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year = parseYear(body.year ?? body.reportYear);
    if (!year) {
      return NextResponse.json({ success: false, error: "Missing or invalid year" }, { status: 400 });
    }

    const cookieHeader = req.headers.get("cookie") || "";
    const userLabel = session.user.email || session.user.name || session.user.id || "hub-sync-modules";

    const refreshed = await refreshHubModulesForRegen(year, cookieHeader, userLabel);
    if (!refreshed.ok) {
      return NextResponse.json(
        { success: false, error: refreshed.error || "Hub sync failed" },
        { status: 500 },
      );
    }

    const state = refreshed.saved;
    const visibleSections = refreshed.findingSections || [];

    const sharedSessionId = sharedReportSessionId(year);
    try {
      const meta = await readMeta(sharedSessionId);
      if (meta) {
        await writeMeta(sharedSessionId, {
          ...meta,
          moduleTablesHash: computeModuleTablesHash(visibleSections),
          updatedAt: new Date().toISOString(),
        });
        const narrative = pickNarrativeFromReportState(state);
        await savePreviewPayload(
          sharedSessionId,
          {
            year,
            previewSnapshotHash: computePreviewSnapshotHash(
              state.auditVisibleByDept,
              visibleSections,
              narrative,
            ),
            auditVisibleByDept: state.auditVisibleByDept,
            ...narrative,
          },
          { narrativeOnly: true },
        );
      }
    } catch (err) {
      console.warn("[hub/sync-modules] preview payload:", err?.message || err);
    }

    broadcastReportStateChange({
      year,
      revision: Number(state.onlyOfficeSyncRevision) || 0,
      hubRevision: getHubRevision(state),
      moduleTablesRevision: state.moduleTablesRevision,
      source: HUB_CHANGE_SOURCE.MODULE_TABLES,
    });

    return NextResponse.json(
      {
        success: true,
        year,
        state,
        moduleTablesRevision: state.moduleTablesRevision,
        onlyOfficeSyncRevision: state.onlyOfficeSyncRevision,
        sections: visibleSections,
        lockedByDept: refreshed.lockedByDept,
        bootstrapped: refreshed.bootstrapped === true,
        docxPatchMode: "hub-only",
        docxSkipped: true,
        docxBootstrapped: refreshed.bootstrapped === true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("POST /api/report/hub/sync-modules:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
