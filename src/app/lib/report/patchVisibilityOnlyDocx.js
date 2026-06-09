import { runReportMergeJob, MERGE_JOB_SOURCE } from "./reportMergeWorker";

/**
 * Lock/unlock → merge worker patch SYSTEM blocks saja (visibility diff).
 */
export async function patchVisibilityOnlyDocx(year, sessionId, blockSync, saved) {
  return runReportMergeJob({
    year,
    sessionId,
    blockSync,
    saved,
    source: MERGE_JOB_SOURCE.VISIBILITY,
    payloadMode: "module-sync",
  });
}
