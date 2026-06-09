import { readDocx, docxExists } from "./documentStore";
import { runReportMergeJob, MERGE_JOB_SOURCE } from "./reportMergeWorker";
import { syncSystemBlocksInHub } from "./reportBlocks";
import {
  docxHasSystemTableMarkers,
  reconcileBlockSyncWithDocx,
} from "./docx/docxBlockEngine";
import { docxNeedsLegacyVisibilityPatch } from "./patchLegacyDeptVisibilityDocx";
import { sharedReportSessionId } from "./onlyOfficeDocxGuard";

/**
 * Lock/unlock → patch Word HANYA jika DOCX punya marker SYSTEM.
 *
 * DOCX legacy (tanpa KIASBLOCK): hub/HTML preview saja — jangan flush OnlyOffice
 * dan jangan patch (pernah memotong Conclusion/Appendices).
 */
export async function syncPublishVisibilityToDocx(year, deptKey, isLocked, saved) {
  const sessionId = sharedReportSessionId(year);
  if (!(await docxExists(sessionId))) {
    return { ok: false, error: "no-docx", skipped: true };
  }

  const buf = await readDocx(sessionId);

  if (docxNeedsLegacyVisibilityPatch(buf)) {
    return {
      ok: true,
      skipped: true,
      patched: false,
      patchMode: "hub-only",
      wordUnchanged: true,
      reason:
        "DOCX belum punya marker KIASBLOCK — lock/unlock hanya HTML preview. Word tidak diubah agar Conclusion/Appendices aman.",
    };
  }

  const blockSync = syncSystemBlocksInHub(
    saved,
    saved.findingSections || [],
    saved.auditVisibleByDept || {},
  );
  const reconciled = reconcileBlockSyncWithDocx(buf, blockSync);

  if (!docxHasSystemTableMarkers(buf)) {
    return {
      ok: true,
      skipped: true,
      patched: false,
      patchMode: "hub-only",
      wordUnchanged: true,
    };
  }

  const markerPatch = await runReportMergeJob({
    year,
    sessionId,
    blockSync: reconciled,
    saved,
    source: MERGE_JOB_SOURCE.VISIBILITY,
    docxBuffer: buf,
  });
  return { ...markerPatch, visibilityMode: "markers" };
}
