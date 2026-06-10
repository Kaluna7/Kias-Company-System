export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  readReportState,
  writeReportState,
  pickReportStatePayload,
} from "@/app/lib/report/reportStateStore";
import { getAuditReviewPublishStateForReport } from "@/app/lib/audit-review/reportPublishLock";
import { DEPT_KEY_TO_API_PATH } from "@/app/lib/audit-review/auditDeptKeys";
import {
  applyAuditVisibilityToSections,
  buildEffectivePublishMap,
  computePreviewSnapshotHash,
  mergeModuleSectionsForHub,
} from "@/app/lib/report/previewAuditVisibility";
import { loadFindingSectionsForPreviewServer } from "@/app/lib/report/loadFindingSectionsServer";
import { readMeta, writeMeta } from "@/app/lib/report/documentStore";
import { savePreviewPayload } from "@/app/lib/report/previewPayloadStore";
import { mergeReportStateForPersist } from "@/app/lib/report/mergeReportStateForPersist";
import { computeModuleTablesHash } from "@/app/lib/report/moduleTablesHash";
import { getReportResetGeneration } from "@/app/lib/report/reportResetGeneration";
import { broadcastPreviewStatePush } from "@/app/lib/report/previewRealtimeHub";
import {
  bumpPreviewSyncRevision,
  pickPreviewWsSyncState,
} from "@/app/lib/report/pickPreviewWsSyncState";

async function filterSavedStateForPublish(state, reportYear) {
  if (!state || typeof state !== "object") return state;
  const sections = state.findingSections;
  if (!Array.isArray(sections) || sections.length === 0) return state;

  const apiPublishByDept = {};
  await Promise.all(
    sections.map(async (section) => {
      const apiPath = DEPT_KEY_TO_API_PATH[section.deptKey] || section.deptKey;
      const publish = await getAuditReviewPublishStateForReport(apiPath, reportYear);
      apiPublishByDept[section.deptKey] = publish.isPublished === true;
    }),
  );

  const effectivePublish = buildEffectivePublishMap(
    apiPublishByDept,
    state.auditVisibleByDept || {},
  );

  return {
    ...state,
    findingSections: applyAuditVisibilityToSections(sections, effectivePublish),
  };
}

function parseYear(value) {
  const y = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return y;
}

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

    const state = await readReportState(year);
    const resetGeneration = await getReportResetGeneration(year);
    return NextResponse.json({ success: true, year, state, resetGeneration });
  } catch (err) {
    console.error("GET /api/report/state:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}

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

    const incoming = pickReportStatePayload(body.state ?? body);
    const existing = (await readReportState(year)) || {};
    const user = session.user;

    if (body.syncMode === "moduleTablesOnly") {
      const cookieHeader = req.headers.get("cookie") || "";
      let moduleSections = [];
      try {
        const loaded = await loadFindingSectionsForPreviewServer(year, cookieHeader);
        moduleSections = loaded.sections || [];
      } catch (err) {
        console.warn("[report/state] module reload:", err?.message || err);
      }
      const state = bumpPreviewSyncRevision({
        ...existing,
        findingSections: mergeModuleSectionsForHub(
          existing.findingSections || [],
          moduleSections.length ? moduleSections : incoming.findingSections || [],
        ),
        hiddenAuditFindingEdits:
          incoming.hiddenAuditFindingEdits &&
          typeof incoming.hiddenAuditFindingEdits === "object"
            ? incoming.hiddenAuditFindingEdits
            : existing.hiddenAuditFindingEdits,
        auditVisibleByDept: {
          ...(existing.auditVisibleByDept || {}),
          ...(incoming.auditVisibleByDept || {}),
        },
        ...(Array.isArray(incoming.auditTeam) ? { auditTeam: incoming.auditTeam } : {}),
        ...(Array.isArray(incoming.preparedBy) ? { preparedBy: incoming.preparedBy } : {}),
        ...(typeof incoming.auditCommitteeName === "string"
          ? { auditCommitteeName: incoming.auditCommitteeName }
          : {}),
        ...(typeof incoming.auditCommitteeDate === "string"
          ? { auditCommitteeDate: incoming.auditCommitteeDate }
          : {}),
        ...(typeof incoming.presidentDirectorName === "string"
          ? { presidentDirectorName: incoming.presidentDirectorName }
          : {}),
        ...(typeof incoming.presidentDirectorDate === "string"
          ? { presidentDirectorDate: incoming.presidentDirectorDate }
          : {}),
      });
      await writeReportState(year, state, user.email || user.name || user.id || "user");
    } else {
      const state = mergeReportStateForPersist(existing, incoming, {
        allowNarrativeOverwrite: body.allowNarrativeOverwrite === true,
      });
      await writeReportState(year, state, user.email || user.name || user.id || "user");
    }

    const state = (await readReportState(year)) || {};

    const sharedSessionId = `shared-report-${year}`;
    try {
      const meta = await readMeta(sharedSessionId);
      if (meta) {
        const moduleTablesHash = computeModuleTablesHash(state.findingSections || []);
        const previewSnapshotHash = computePreviewSnapshotHash(
          state.auditVisibleByDept,
          state.findingSections,
          {
            executiveSummaryHtml: state.executiveSummaryHtml,
            auditObjectivesScopeHtml: state.auditObjectivesScopeHtml,
            auditApproachMethodologyHtml: state.auditApproachMethodologyHtml,
            conclusionValues: state.conclusionValues,
          },
        );
        await writeMeta(sharedSessionId, {
          ...meta,
          moduleTablesHash,
          updatedAt: new Date().toISOString(),
        });
        await savePreviewPayload(
          sharedSessionId,
          {
            year,
            previewSnapshotHash,
            periodStart: state.periodStart,
            periodEnd: state.periodEnd,
            auditCoverage: state.auditCoverage,
            departmentCoverage: state.departmentCoverage,
            area: state.area,
            auditVisibleByDept: state.auditVisibleByDept,
            executiveSummaryHtml: state.executiveSummaryHtml,
            auditObjectivesScopeHtml: state.auditObjectivesScopeHtml,
            auditApproachMethodologyHtml: state.auditApproachMethodologyHtml,
            conclusionValues: state.conclusionValues,
            appendices: state.appendices,
          },
          { narrativeOnly: true },
        );
      }
    } catch (err) {
      console.warn("[report/state] sync preview payload:", err?.message || err);
    }

    if (body.syncMode !== "moduleTablesOnly") {
      try {
        const syncState = pickPreviewWsSyncState(state);
        broadcastPreviewStatePush(year, syncState, {
          senderClientId: "server",
          previewSyncRevision: syncState.previewSyncRevision,
        });
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({ success: true, year, state });
  } catch (err) {
    console.error("POST /api/report/state:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
