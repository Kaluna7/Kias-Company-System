export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { broadcastAuditPublishChange } from "@/app/lib/audit-review/auditPublishHub";
import { reportDeptKeyFromRouteOrApi } from "@/app/lib/audit-review/auditDeptKeys";
import { getAuditReviewPublishStateForReport } from "@/app/lib/audit-review/reportPublishLock";
import { DEPT_KEY_TO_API_PATH } from "@/app/lib/audit-review/auditDeptKeys";
import { readReportState, writeReportState } from "@/app/lib/report/reportStateStore";
import { mergeModuleTablesIntoHub } from "@/app/lib/report/reportPreviewHub";
import { broadcastReportStateChange } from "@/app/lib/report/reportStateHub";
import { loadFindingSectionsForPreviewServer } from "@/app/lib/report/loadFindingSectionsServer";
import { sharedReportSessionId } from "@/app/lib/report/onlyOfficeDocxGuard";
import { mergeModuleSectionsForHub } from "@/app/lib/report/previewAuditVisibility";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const year =
      Number(body.reportYear) ||
      Number(body.year) ||
      Number(body.auditYear) ||
      new Date().getFullYear();
    const deptKey = reportDeptKeyFromRouteOrApi(body.deptKey, body.apiPath);
    const apiPath = body.apiPath || DEPT_KEY_TO_API_PATH[deptKey] || deptKey;

    let isLocked = body.isLocked === true;
    if (body.isLocked === undefined || body.isLocked === null) {
      const state = await getAuditReviewPublishStateForReport(apiPath, year);
      isLocked = state.isPublished === true;
    }

    const payload = {
      year,
      deptKey,
      apiPath,
      isLocked,
    };

    broadcastAuditPublishChange(payload);

    const cookieHeader = req.headers.get("cookie") || "";
    const userLabel = session.user?.email || session.user?.name || "publish-notify";
    const existing = (await readReportState(year)) || {};

    /** Source of truth: Module API — bukan preview yang sudah di-strip. */
    const { sections, lockedByDept } = await loadFindingSectionsForPreviewServer(
      year,
      cookieHeader,
      { pendingPublishByDept: { [deptKey]: isLocked } },
    );

    /** Selalu muat ulang dari modul — jangan simpan shell kosong auditRows/sopRows. */
    const fullSections = mergeModuleSectionsForHub(existing.findingSections || [], sections || []);

    const auditVisibleByDept = {
      ...(existing.auditVisibleByDept || {}),
      [deptKey]: isLocked,
    };

    let nextState = mergeModuleTablesIntoHub(existing, {
      findingSections: fullSections,
      auditVisibleByDept,
      hiddenAuditFindingEdits: existing.hiddenAuditFindingEdits,
    });
    await writeReportState(year, nextState, userLabel);

    broadcastReportStateChange({
      year,
      revision: Number(nextState?.onlyOfficeSyncRevision) || 0,
      hubRevision: nextState?.hubRevision || 0,
      moduleTablesRevision: nextState?.moduleTablesRevision || 0,
      source: "audit-publish",
    });

    const lockedSection = (fullSections || []).find((s) => s.deptKey === deptKey);
    const storedAuditRows = lockedSection?.auditRows?.length ?? 0;

    /** Lock/unlock → hub DB + HTML preview. Word: gunakan Refresh Report (full regen dari DB). */
    const docxSync = {
      ok: true,
      skipped: true,
      patched: false,
      patchMode: "db-only",
      wordUnchanged: true,
      reason:
        "Narasi & tabel disinkronkan ke DB. Klik Refresh Report di Preview untuk memperbarui Word.",
    };

    return NextResponse.json({
      success: true,
      ...payload,
      hubSynced: true,
      moduleAuditRowsStored: storedAuditRows,
      lockedByDept,
      docxSync,
      docxPatched: docxSync?.patched === true,
      sessionId: sharedReportSessionId(year),
      /** Baris audit yang tampil di preview saat lock (bukan yang tersimpan). */
      lockedDeptAuditRows: isLocked ? storedAuditRows : 0,
      lockedDeptSopRows: lockedSection?.sopRows?.length ?? 0,
      lockedDeptHasExecSummary: Boolean(lockedSection?.executiveSummary),
    });
  } catch (err) {
    console.error("POST /api/audit-review/publish-notify:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
