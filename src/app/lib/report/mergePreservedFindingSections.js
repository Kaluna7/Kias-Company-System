function mergeExecutiveSummary(incoming, preserved) {
  if (!preserved || typeof preserved !== "object") return incoming ?? null;
  if (!incoming || typeof incoming !== "object") return preserved;
  const merged = { ...incoming };
  for (const [key, value] of Object.entries(preserved)) {
    if (value == null || value === "") continue;
    if (typeof value === "string" && !value.trim()) continue;
    merged[key] = value;
  }
  return merged;
}

/** SOP Review module/API is source of truth for all SOP row fields (incl. auditee & follow-up). */
function mergeSopRowsFromModule(incomingRows, preservedRows) {
  if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
    return preservedRows || [];
  }
  return incomingRows;
}

function mergeRows(incomingRows, preservedRows) {
  if (!Array.isArray(preservedRows) || preservedRows.length === 0) {
    return incomingRows || [];
  }
  if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
    return preservedRows;
  }

  const presMap = new Map();
  preservedRows.forEach((row, idx) => {
    presMap.set(String(row.sourceIndex ?? idx), row);
  });

  return incomingRows.map((row, idx) => {
    const key = String(row.sourceIndex ?? idx);
    const prev = presMap.get(key);
    if (!prev) return row;

    const merged = { ...row };
    for (const [field, value] of Object.entries(prev)) {
      if (field === "no" || field === "sourceIndex") continue;
      if (value == null || value === "") continue;
      if (typeof value === "string" && !value.trim()) continue;
      merged[field] = value;
    }
    return merged;
  });
}

/**
 * Keep user edits in report preview when audit-review data reloads (lock/unlock).
 * @param {Array} incoming Fresh sections from APIs
 * @param {Array|null|undefined} preserved Previous UI state or DB snapshot
 */
/**
 * @param {Record<string, boolean>} lockedByDept deptKey → published/locked for report
 * @param {Record<string, object[]>} [hiddenAuditByDept] restored audit row edits when dept was unlocked
 */
export function mergePreservedFindingSections(
  incoming,
  preserved,
  lockedByDept = {},
  hiddenAuditByDept = {},
  options = {},
) {
  const freshModuleReload = options.freshModuleReload === true;
  if (!Array.isArray(incoming)) return [];
  if (!Array.isArray(preserved) || preserved.length === 0) {
    return incoming.map((section) => {
      const isLocked = lockedByDept[section.deptKey] === true;
      if (!isLocked) {
        return { ...section, auditRows: [], executiveSummary: null };
      }
      const hidden = hiddenAuditByDept[section.deptKey];
      return hidden?.length
        ? { ...section, auditRows: mergeRows(section.auditRows, hidden) }
        : section;
    });
  }

  const presByDept = new Map(preserved.map((s) => [s.deptKey, s]));

  return incoming.map((section) => {
    const prev = presByDept.get(section.deptKey);
    const isLocked = lockedByDept[section.deptKey] === true;
    const hiddenAudit = hiddenAuditByDept[section.deptKey];

    if (!prev) {
      if (!isLocked) {
        return { ...section, auditRows: [], executiveSummary: null };
      }
      return hiddenAudit?.length
        ? { ...section, auditRows: mergeRows(section.auditRows, hiddenAudit) }
        : section;
    }

    const preservedAudit =
      (prev.auditRows?.length ? prev.auditRows : null) ||
      (hiddenAudit?.length ? hiddenAudit : null);

    if (!isLocked) {
      return {
        ...section,
        areaAudit: freshModuleReload
          ? section.areaAudit
          : String(prev.areaAudit || "").trim() && prev.areaAudit !== section.areaAudit
            ? prev.areaAudit
            : section.areaAudit,
        executiveSummary: null,
        sopRows: mergeSopRowsFromModule(section.sopRows, prev.sopRows),
        auditRows: [],
        _preservedAuditRows: preservedAudit || [],
      };
    }

    return {
      ...section,
      areaAudit: freshModuleReload
        ? section.areaAudit
        : String(prev.areaAudit || "").trim() && prev.areaAudit !== section.areaAudit
          ? prev.areaAudit
          : section.areaAudit,
      executiveSummary: freshModuleReload
        ? section.executiveSummary
        : mergeExecutiveSummary(section.executiveSummary, prev.executiveSummary),
      sopRows: mergeSopRowsFromModule(section.sopRows, prev.sopRows),
      auditRows: freshModuleReload
        ? section.auditRows || []
        : mergeRows(section.auditRows, preservedAudit || []),
    };
  });
}

/** Collect audit row edits stashed on sections while unlocked. */
export function collectHiddenAuditEdits(sections) {
  const out = {};
  if (!Array.isArray(sections)) return out;
  for (const section of sections) {
    const rows =
      Array.isArray(section._preservedAuditRows) && section._preservedAuditRows.length > 0
        ? section._preservedAuditRows
        : section.auditRows;
    if (Array.isArray(rows) && rows.length > 0) {
      out[section.deptKey] = rows;
    }
  }
  return out;
}

/** Strip internal stash field before render/save payload. */
export function stripFindingSectionsForClient(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map(({ _preservedAuditRows, ...section }) => section);
}
