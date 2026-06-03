/** Browser helpers — notify report preview when SOP Review data changes. */

import { reportDeptKeyFromRouteOrApi } from "@/app/lib/audit-review/auditDeptKeys";

export const SOP_REVIEW_DATA_CHANGED_KEY = "sop-review-data-changed";
export const SOP_REVIEW_DATA_BROADCAST_CHANNEL = "kias-sop-review-data";

/**
 * @param {{ year?: number, reportYear?: number, deptKey?: string, apiPath?: string, action?: string }} params
 */
export function notifySopReviewDataChanged(params = {}) {
  if (typeof window === "undefined") return;

  const reportYear =
    params.reportYear != null && Number.isFinite(Number(params.reportYear))
      ? Number(params.reportYear)
      : params.year != null && Number.isFinite(Number(params.year))
        ? Number(params.year)
        : new Date().getFullYear();

  const deptKey = reportDeptKeyFromRouteOrApi(params.deptKey, params.apiPath);
  const payload = {
    ts: Date.now(),
    year: reportYear,
    reportYear,
    deptKey,
    apiPath: params.apiPath || null,
    action: params.action || "update",
  };

  try {
    localStorage.setItem(SOP_REVIEW_DATA_CHANGED_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }

  try {
    const bc = new BroadcastChannel(SOP_REVIEW_DATA_BROADCAST_CHANNEL);
    bc.postMessage(payload);
    bc.close();
  } catch {
    /* ignore */
  }

  window.dispatchEvent(new CustomEvent(SOP_REVIEW_DATA_CHANGED_KEY, { detail: payload }));

  const postNotify = () => {
    fetch("/api/sop-review/notify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => console.warn("[sop-review-notify]", err));
  };
  // Let PATCH commit + Next cache settle before report preview pulls module APIs.
  window.setTimeout(postNotify, 80);
  window.setTimeout(postNotify, 500);
  window.setTimeout(postNotify, 1200);
}

export function yearFromPublishedAt(publishedAt) {
  if (!publishedAt) return new Date().getFullYear();
  const d = new Date(publishedAt);
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}
