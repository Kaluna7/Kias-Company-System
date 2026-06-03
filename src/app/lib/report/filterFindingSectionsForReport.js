import { getAuditReviewPublishStateForReport } from "@/app/lib/audit-review/reportPublishLock";

/** deptKey (report preview) → audit-review API path */
const DEPT_KEY_TO_API_PATH = {
  finance: "finance",
  accounting: "accounting",
  hrd: "hrd",
  ga: "g&a",
  sdp: "sdp",
  tax: "tax",
  lp: "l&p",
  mis: "mis",
  merch: "merch",
  ops: "ops",
  whs: "whs",
};

/**
 * Strip audit-review tables from report payload when dept is unlocked.
 * Removes entire dept section if it only contained audit-review data.
 */
export async function filterFindingSectionsForReportPublish(sections, reportYear) {
  if (!Array.isArray(sections) || sections.length === 0) return [];

  const filtered = [];
  for (const section of sections) {
    const apiPath = DEPT_KEY_TO_API_PATH[section.deptKey] || section.deptKey;
    const publishState = await getAuditReviewPublishStateForReport(apiPath, reportYear);

    if (!publishState.isPublished) {
      const sopRows = section.sopRows || [];
      if (sopRows.length === 0) continue;
      filtered.push({
        ...section,
        auditRows: [],
        executiveSummary: null,
      });
      continue;
    }

    filtered.push(section);
  }

  return filtered;
}

export async function filterReportPayloadForPublish(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const year = Number(payload.year) || new Date().getFullYear();
  const findingSections = await filterFindingSectionsForReportPublish(
    payload.findingSections,
    Number.isFinite(year) ? year : null,
  );

  const findingPages = Array.isArray(payload.findingPages)
    ? payload.findingPages.map((page) => {
        const apiPath = DEPT_KEY_TO_API_PATH[page.deptKey] || page.deptKey;
        return { page, apiPath };
      })
    : [];

  let publishByDept = {};
  await Promise.all(
    [...new Set(findingPages.map((p) => p.apiPath))].map(async (apiPath) => {
      const state = await getAuditReviewPublishStateForReport(apiPath, year);
      publishByDept[apiPath] = state.isPublished;
    }),
  );

  const filteredFindingPages = (payload.findingPages || []).filter((page) => {
    const apiPath = DEPT_KEY_TO_API_PATH[page.deptKey] || page.deptKey;
    if (publishByDept[apiPath]) return true;
    return (page.sopRows || []).length > 0;
  }).map((page) => {
    const apiPath = DEPT_KEY_TO_API_PATH[page.deptKey] || page.deptKey;
    if (publishByDept[apiPath]) return page;
    return { ...page, auditRows: [], executiveSummary: null };
  });

  return {
    ...payload,
    findingSections,
    findingPages: filteredFindingPages,
  };
}
