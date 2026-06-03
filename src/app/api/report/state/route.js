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
} from "@/app/lib/report/previewAuditVisibility";
import { readMeta, writeMeta } from "@/app/lib/report/documentStore";
import { savePreviewPayload } from "@/app/lib/report/previewPayloadStore";
import { mergeReportStateForPersist } from "@/app/lib/report/mergeReportStateForPersist";
import { computeModuleTablesHash } from "@/app/lib/report/moduleTablesHash";
import {
  mergeModuleTablesIntoHub,
  getHubRevision,
  HUB_CHANGE_SOURCE,
  HUB_SYNC_MODE_MODULE_TABLES_ONLY,
} from "@/app/lib/report/reportPreviewHub";
import { broadcastReportStateChange } from "@/app/lib/report/reportStateHub";

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
    const filtered = state ? await filterSavedStateForPublish(state, year) : null;
    return NextResponse.json({ success: true, year, state: filtered });
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
      const state = {
        ...existing,
        findingSections: Array.isArray(incoming.findingSections)
          ? incoming.findingSections
          : existing.findingSections,
        hiddenAuditFindingEdits:
          incoming.hiddenAuditFindingEdits &&
          typeof incoming.hiddenAuditFindingEdits === "object"
            ? incoming.hiddenAuditFindingEdits
            : existing.hiddenAuditFindingEdits,
        auditVisibleByDept: {
          ...(existing.auditVisibleByDept || {}),
          ...(incoming.auditVisibleByDept || {}),
        },
      };
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
        await savePreviewPayload(sharedSessionId, {
          year,
          source: "html-preview",
          previewSnapshotHash,
          auditVisibleByDept: state.auditVisibleByDept,
          executiveSummaryHtml: state.executiveSummaryHtml,
          auditObjectivesScopeHtml: state.auditObjectivesScopeHtml,
          auditApproachMethodologyHtml: state.auditApproachMethodologyHtml,
          conclusionValues: state.conclusionValues,
          appendices: state.appendices,
          findingSections: state.findingSections,
        });
      }
    } catch (err) {
      console.warn("[report/state] sync preview payload:", err?.message || err);
    }

    try {
      broadcastReportStateChange({
        year,
        revision: Number(state.onlyOfficeSyncRevision) || 0,
        hubRevision: getHubRevision(state),
        moduleTablesRevision: Number(state.moduleTablesRevision) || 0,
        source:
          body.syncMode === HUB_SYNC_MODE_MODULE_TABLES_ONLY
            ? HUB_CHANGE_SOURCE.MODULE_TABLES
            : HUB_CHANGE_SOURCE.PREVIEW,
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({ success: true, year, state });
  } catch (err) {
    console.error("POST /api/report/state:", err);
    return NextResponse.json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
