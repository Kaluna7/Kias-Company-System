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

/** Clear browser-stored report draft progress for a year. */
export function clearClientReportProgress(year) {
  if (typeof window === "undefined") return;
  for (const key of getReportPreviewStorageKeys(year)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function getSharedReportSessionId(year) {
  return `shared-report-${Number(year)}`;
}
