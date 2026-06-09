import { buildEffectivePublishMap } from "./previewAuditVisibility";
import {
  filterFindingSectionsForDisplay,
  isDeptPublishedToReport,
} from "./applyPublishStateToFindingSections";
import { loadLockedByDeptForReport } from "./loadLockedByDeptForReport";

function filterFindingPagesForDisplay(pages, effectivePublish) {
  if (!Array.isArray(pages)) return [];
  return pages
    .map((page) => {
      const deptKey = page.deptKey || page.dept?.deptKey;
      const locked = isDeptPublishedToReport(deptKey, effectivePublish);
      if (locked) return page;
      return {
        ...page,
        executiveSummary: null,
        auditRows: [],
        dept: page.dept
          ? {
              ...page.dept,
              executiveSummary: null,
              auditRows: [],
            }
          : page.dept,
      };
    })
    .filter((page) => {
      const deptKey = page.deptKey || page.dept?.deptKey;
      const locked = isDeptPublishedToReport(deptKey, effectivePublish);
      const hasSop = (page.sopRows?.length || 0) > 0;
      const hasAudit = locked && (page.auditRows?.length || 0) > 0;
      const hasExec =
        locked &&
        Boolean(
          page.executiveSummary ||
            (page.isFirstPageForDept && page.dept?.executiveSummary),
        );
      return hasSop || hasAudit || hasExec;
    });
}

function filterFindingDetailPagesForDisplay(pages, effectivePublish) {
  if (!Array.isArray(pages)) return [];
  return pages.filter((item) =>
    isDeptPublishedToReport(item?.section?.deptKey, effectivePublish),
  );
}

/**
 * Apply the same lock/unlock visibility rules as HTML Preview before DOCX generate.
 * @param {object} payload
 * @param {number} year
 * @param {object} [options]
 * @param {Record<string, boolean>} [options.lockedByDept]
 */
export async function applyHtmlPreviewVisibilityToPayload(payload, year, options = {}) {
  const rawSections = Array.isArray(payload?.findingSections) ? payload.findingSections : [];
  const lockedByDept =
    options.lockedByDept && typeof options.lockedByDept === "object"
      ? options.lockedByDept
      : await loadLockedByDeptForReport(year);

  const auditVisibleByDept =
    payload?.auditVisibleByDept && typeof payload.auditVisibleByDept === "object"
      ? payload.auditVisibleByDept
      : {};

  const effectivePublish = buildEffectivePublishMap(
    lockedByDept,
    auditVisibleByDept,
    rawSections,
  );

  const findingSections = filterFindingSectionsForDisplay(rawSections, effectivePublish);

  const deptIndexMap = { ...(payload.deptIndexMap || {}) };
  findingSections.forEach((section, index) => {
    if (section?.deptKey && deptIndexMap[section.deptKey] == null) {
      deptIndexMap[section.deptKey] = index + 1;
    }
  });

  return {
    ...payload,
    findingSections,
    deptIndexMap,
    auditVisibleByDept,
    lockedByDept,
    effectivePublishByDept: effectivePublish,
    findingPages: filterFindingPagesForDisplay(payload.findingPages, effectivePublish),
    findingDetailPages: filterFindingDetailPagesForDisplay(
      payload.findingDetailPages,
      effectivePublish,
    ),
  };
}
