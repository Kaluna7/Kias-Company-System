import {
  storageKeyForHubChanged,
  storageKeyForOnlyOfficeSync,
} from "./reportPreviewSyncEvents";

/** localStorage keys for report preview draft content (per audit year). */

export function getReportPreviewStorageKeys(year) {
  const y = String(year);
  return [
    `report-preview-appendices-${y}`,
    `report-preview-executive-summary-${y}`,
    `report-preview-audit-objectives-scope-${y}`,
    `report-preview-audit-approach-methodology-${y}`,
  ];
}

export function getClientResetGenerationKey(year) {
  return `report-reset-generation-${Number(year)}`;
}

/** Clear browser-stored report draft progress for a year. */
export function clearClientReportProgress(year) {
  if (typeof window === "undefined") return;
  const keys = [
    ...getReportPreviewStorageKeys(year),
    storageKeyForHubChanged(year),
    storageKeyForOnlyOfficeSync(year),
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/** Remember server reset generation so open preview tabs can drop stale edits. */
export function markClientReportReset(year, generation) {
  if (typeof window === "undefined") return;
  clearClientReportProgress(year);
  try {
    localStorage.setItem(getClientResetGenerationKey(year), String(Number(generation) || 0));
  } catch {
    /* ignore */
  }
}

export function getClientReportResetGeneration(year) {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(getClientResetGenerationKey(year))) || 0;
  } catch {
    return 0;
  }
}

export function getSharedReportSessionId(year) {
  return `shared-report-${Number(year)}`;
}
