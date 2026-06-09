import { readDocx, docxExists } from "./documentStore";
import {
  reconcileBlockSyncWithDocx,
} from "./docx/docxBlockEngine";
import { runReportMergeJob, MERGE_JOB_SOURCE } from "./reportMergeWorker";

/**
 * Ganti HANYA bagian Findings & Recommendations di DOCX (merge worker).
 * Paper / narasi user di file Word tidak disentuh.
 */
export async function regenerateFindingsPaperInDocx(year, sessionId, blockSync, saved, options = {}) {
  if (!(await docxExists(sessionId))) {
    return { ok: false, error: "no-docx", regenerated: false };
  }

  const docxBuffer = await readDocx(sessionId);
  return runReportMergeJob({
    year,
    sessionId,
    blockSync,
    saved,
    source: MERGE_JOB_SOURCE.MODULE_TABLES,
    docxBuffer,
    skipUnsafeWithoutMarkers: true,
    fileBefore: options.fileBefore,
    payloadMode: "papers",
  });
}

/** Reconcile block sync dengan isi DOCX aktual. */
export function finalizeFindingsBlockSync(docxBuffer, blockSync) {
  return reconcileBlockSyncWithDocx(docxBuffer, blockSync);
}
