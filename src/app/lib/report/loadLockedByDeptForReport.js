import { getAuditReviewPublishStateForReport } from "@/app/lib/audit-review/reportPublishLock";
import {
  DEPT_KEY_TO_API_PATH,
  REPORT_DEPT_KEYS,
} from "@/app/lib/audit-review/auditDeptKeys";

/**
 * Live lock/unlock from Audit Review DB — same source as HTML preview publish-status.
 * @param {number} year
 * @returns {Promise<Record<string, boolean>>}
 */
export async function loadLockedByDeptForReport(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return {};

  const lockedByDept = {};
  await Promise.all(
    REPORT_DEPT_KEYS.map(async (deptKey) => {
      const apiPath = DEPT_KEY_TO_API_PATH[deptKey];
      if (!apiPath) return;
      try {
        const state = await getAuditReviewPublishStateForReport(apiPath, y);
        lockedByDept[deptKey] = state.isPublished === true;
      } catch {
        lockedByDept[deptKey] = false;
      }
    }),
  );
  return lockedByDept;
}
