"use client";

const DEFAULT_DISMISS_MS = 30 * 60 * 1000;

function storageKey(year) {
  return `kias-onlyoffice-dismiss-${Number(year)}`;
}

/** User chose to leave OnlyOffice — skip auto-redirect for a while. */
export function markOnlyOfficeAutoJoinDismissed(year, ms = DEFAULT_DISMISS_MS) {
  if (typeof window === "undefined" || !Number.isFinite(Number(year))) return;
  try {
    window.sessionStorage.setItem(
      storageKey(year),
      String(Date.now() + Math.max(60_000, Number(ms) || DEFAULT_DISMISS_MS)),
    );
  } catch {
    /* ignore */
  }
}

export function isOnlyOfficeAutoJoinDismissed(year) {
  if (typeof window === "undefined" || !Number.isFinite(Number(year))) return false;
  try {
    const raw = window.sessionStorage.getItem(storageKey(year));
    if (!raw) return false;
    const until = parseInt(raw, 10);
    if (!Number.isFinite(until) || Date.now() >= until) {
      window.sessionStorage.removeItem(storageKey(year));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Allow auto-join again (Create Word, or Open Report to join teammate). */
export function clearOnlyOfficeAutoJoinDismissed(year) {
  if (typeof window === "undefined" || !Number.isFinite(Number(year))) return;
  try {
    window.sessionStorage.removeItem(storageKey(year));
  } catch {
    /* ignore */
  }
}
