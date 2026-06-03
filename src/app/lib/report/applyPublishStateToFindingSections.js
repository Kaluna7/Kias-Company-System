/**
 * Lock = show audit-review executive summary + findings table in report.
 * Unlock = hide them (SOP-only sections may remain).
 */

/** Authoritative: only publishStatusByDept / lockedByDept from server — never section flags alone. */
export function isDeptPublishedToReport(deptKey, publishStatusByDept = {}) {
  return publishStatusByDept[deptKey] === true;
}

export function applyPublishStateToFindingSections(sections, publishStatusByDept = {}) {
  if (!Array.isArray(sections)) return [];

  return sections.map((section) => {
    const isPublished = isDeptPublishedToReport(section.deptKey, publishStatusByDept);

    if (isPublished) {
      return { ...section, isPublishedToReport: true };
    }

    const { _preservedAuditRows, executiveSummary, auditRows, ...rest } = section;
    return {
      ...rest,
      isPublishedToReport: false,
      executiveSummary: null,
      auditRows: [],
      ...(Array.isArray(_preservedAuditRows) && _preservedAuditRows.length > 0
        ? { _preservedAuditRows }
        : {}),
    };
  });
}

export function filterFindingSectionsForDisplay(sections, publishStatusByDept = {}) {
  if (!Array.isArray(sections)) return [];

  return sections
    .map((section) => {
      const isPublished = isDeptPublishedToReport(section.deptKey, publishStatusByDept);
      if (isPublished) {
        return {
          ...section,
          isPublishedToReport: true,
          auditRows: section.auditRows || [],
          executiveSummary: section.executiveSummary ?? null,
        };
      }
      const sopRows = section.sopRows || [];
      if (sopRows.length === 0) return null;
      return {
        ...section,
        isPublishedToReport: false,
        auditRows: [],
        executiveSummary: null,
      };
    })
    .filter(Boolean);
}

export function stripAuditFromUnpublishedSections(sections) {
  return applyPublishStateToFindingSections(sections);
}
