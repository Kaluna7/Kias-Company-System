import { readReportState, writeReportState } from "./reportStateStore";
import { touchHubRevision } from "./reportPreviewHub";
import { syncSystemBlocksInHub } from "./reportBlocks";
import { refreshHubModulesForRegen } from "./refreshHubModulesForRegen";

/**
 * Reset HANYA jalur Findings & Recommendations (data modul).
 * Paper lain (cover, ES, conclusion, dll.) tidak disentuh.
 */
export async function resetFindingsPaperInHub(year, cookieHeader = "", updatedBy = "create-report") {
  const refreshed = await refreshHubModulesForRegen(year, cookieHeader, updatedBy);
  if (!refreshed.ok) return refreshed;

  const existing = refreshed.saved;
  const blockSync = syncSystemBlocksInHub(
    { ...existing, reportBlocks: { manifest: [], blocks: {} } },
    refreshed.findingSections,
    existing.auditVisibleByDept || {},
  );

  const next = touchHubRevision({
    ...existing,
    findingSections: refreshed.findingSections,
    reportBlocks: blockSync.reportBlocks,
    findingsPaperResetAt: new Date().toISOString(),
    findingsPaperRevision: (Number(existing.findingsPaperRevision) || 0) + 1,
  });

  await writeReportState(year, next, updatedBy);

  return {
    ok: true,
    saved: next,
    blockSync,
    findingSections: refreshed.findingSections,
    bootstrapped: refreshed.bootstrapped,
  };
}
