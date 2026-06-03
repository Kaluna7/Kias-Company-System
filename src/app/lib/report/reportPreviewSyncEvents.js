export const REPORT_PREVIEW_ONLYOFFICE_SYNC = "report-preview-onlyoffice-sync";
export const REPORT_PREVIEW_HUB_CHANGED = "kias-report-preview-hub-changed";

export function storageKeyForOnlyOfficeSync(year) {
  return `kias-onlyoffice-sync-${year}`;
}

export function storageKeyForHubChanged(year) {
  return `kias-report-hub-changed-${year}`;
}

/** OnlyOffice saved → hub DB updated → HTML preview auto-refresh. */
export function notifyPreviewOnlyOfficeSync(year, revision = null) {
  notifyPreviewHubChanged(year, revision);
}

/** Any hub change (OnlyOffice or modul) → semua tab HTML preview refresh. */
export function notifyPreviewHubChanged(year, hubRevision = null) {
  if (typeof window === "undefined" || !Number.isFinite(year)) return;
  const detail = { year, hubRevision, ts: Date.now() };
  try {
    localStorage.setItem(storageKeyForHubChanged(year), JSON.stringify(detail));
    localStorage.setItem(storageKeyForOnlyOfficeSync(year), JSON.stringify(detail));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(REPORT_PREVIEW_HUB_CHANGED, { detail }));
  window.dispatchEvent(
    new CustomEvent(REPORT_PREVIEW_ONLYOFFICE_SYNC, { detail }),
  );
}
