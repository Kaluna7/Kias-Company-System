import { broadcastSopReviewDataChange } from "./sopReviewDataHub";
import { reportDeptKeyFromRouteOrApi } from "@/app/lib/audit-review/auditDeptKeys";

export function yearFromDateValue(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

/**
 * Server-side broadcast after SOP published data changes (PATCH/DELETE/publish).
 */
export function notifySopReviewDataFromServer(apiPath, options = {}) {
  const deptKey = reportDeptKeyFromRouteOrApi(null, apiPath);
  const year =
    yearFromDateValue(options.publishedAt) ||
    yearFromDateValue(options.auditFieldworkEndDate) ||
    yearFromDateValue(options.auditFieldworkStartDate) ||
    Number(options.year) ||
    new Date().getFullYear();

  broadcastSopReviewDataChange({
    year,
    deptKey,
    apiPath: apiPath || null,
    action: options.action || "update",
  });
}
