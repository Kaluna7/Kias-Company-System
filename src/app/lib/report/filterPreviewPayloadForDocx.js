import { buildEffectivePublishMap } from "./previewAuditVisibility";
import {
  filterFindingSectionsForDisplay,
  isDeptPublishedToReport,
} from "./applyPublishStateToFindingSections";

/** Same visibility rules as HTML Preview pagination — drop unlocked audit-only pages. */
export function filterFindingPagesForPreview(pages, effectivePublishByDept = {}) {
  if (!Array.isArray(pages)) return [];
  return pages.filter((page) => {
    const deptKey = page.deptKey || page.dept?.deptKey || "";
    const published = isDeptPublishedToReport(deptKey, effectivePublishByDept);
    const hasSop = (page.sopRows?.length || 0) > 0;
    const hasAudit = published && (page.auditRows?.length || 0) > 0;
    const exec =
      page.executiveSummary ??
      (page.isFirstPageForDept ? page.dept?.executiveSummary : null);
    const hasExec = published && page.isFirstPageForDept && Boolean(exec);
    if (!published) return hasSop;
    return hasSop || hasAudit || hasExec;
  });
}

/**
 * Apply HTML Preview lock/unlock visibility to export payload before DOCX generate.
 * Uses only fields from the preview export — never database.
 */
export function filterPreviewPayloadForDocx(payload = {}) {
  const auditVisibleByDept =
    payload.auditVisibleByDept && typeof payload.auditVisibleByDept === "object"
      ? payload.auditVisibleByDept
      : {};

  const effectivePublishByDept =
    payload.effectivePublishByDept && typeof payload.effectivePublishByDept === "object"
      ? payload.effectivePublishByDept
      : buildEffectivePublishMap({}, auditVisibleByDept, payload.findingSections || []);

  const findingPages = filterFindingPagesForPreview(payload.findingPages, effectivePublishByDept)
    .map((page) => {
      const deptKey = page.deptKey || page.dept?.deptKey || "";
      const published = isDeptPublishedToReport(deptKey, effectivePublishByDept);
      if (published) return { ...page, dept: undefined };
      return {
        ...page,
        dept: undefined,
        executiveSummary: null,
        auditRows: [],
      };
    });

  const findingSections = filterFindingSectionsForDisplay(
    payload.findingSections || [],
    effectivePublishByDept,
  );

  const findingDetailPages = (Array.isArray(payload.findingDetailPages)
    ? payload.findingDetailPages
    : []
  ).filter((item) =>
    isDeptPublishedToReport(item?.section?.deptKey, effectivePublishByDept),
  );

  return {
    ...payload,
    auditVisibleByDept,
    effectivePublishByDept,
    findingPages,
    findingSections,
    findingDetailPages,
  };
}
