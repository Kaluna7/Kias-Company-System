/** Browser-safe helpers — do not import pg here. */

import { reportDeptKeyFromRouteOrApi } from "./auditDeptKeys";

export const AUDIT_REVIEW_PUBLISH_CHANGED_KEY = "audit-review-publish-changed";
export const AUDIT_PUBLISH_BROADCAST_CHANNEL = "kias-audit-review-publish";

/**
 * Notify report preview (realtime SSE + same-browser tabs + legacy event).
 * @param {{ auditYear?: number, reportYear?: number, year?: number, deptKey?: string, apiPath?: string, isLocked?: boolean }} params
 */
export function notifyAuditReviewPublishChanged(params = {}) {
  if (typeof window === "undefined") return;

  const auditYear =
    params.auditYear != null && Number.isFinite(Number(params.auditYear))
      ? Number(params.auditYear)
      : null;
  const reportYear =
    params.reportYear != null && Number.isFinite(Number(params.reportYear))
      ? Number(params.reportYear)
      : params.year != null && Number.isFinite(Number(params.year))
        ? Number(params.year)
        : auditYear ?? new Date().getFullYear();

  const deptKey = reportDeptKeyFromRouteOrApi(params.deptKey, params.apiPath);
  const isLocked = params.isLocked === true;
  const payload = {
    ts: Date.now(),
    year: reportYear,
    auditYear: auditYear ?? reportYear,
    reportYear,
    deptKey,
    apiPath: params.apiPath || null,
    isLocked,
  };

  try {
    localStorage.setItem(AUDIT_REVIEW_PUBLISH_CHANGED_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }

  try {
    const bc = new BroadcastChannel(AUDIT_PUBLISH_BROADCAST_CHANNEL);
    bc.postMessage(payload);
    bc.close();
  } catch {
    /* ignore */
  }

  window.dispatchEvent(
    new CustomEvent(AUDIT_REVIEW_PUBLISH_CHANGED_KEY, { detail: payload }),
  );

  fetch("/api/audit-review/publish-notify", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      year: reportYear,
      auditYear: auditYear ?? reportYear,
      deptKey,
      apiPath: params.apiPath,
      isLocked,
    }),
  }).catch((err) => console.warn("[publish-notify]", err));
}
