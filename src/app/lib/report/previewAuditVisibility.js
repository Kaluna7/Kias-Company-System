import crypto from "crypto";

/**
 * HTML preview is the source of truth for whether audit-review blocks appear.
 * `auditVisibleByDept[deptKey] === false` always hides audit (even if DB still says locked).
 */

export function buildEffectivePublishMap(apiPublishByDept = {}, auditVisibleByDept = {}) {
  const keys = new Set([
    ...Object.keys(apiPublishByDept || {}),
    ...Object.keys(auditVisibleByDept || {}),
  ]);
  const out = {};
  for (const deptKey of keys) {
    if (auditVisibleByDept[deptKey] === false) {
      out[deptKey] = false;
      continue;
    }
    if (auditVisibleByDept[deptKey] === true) {
      out[deptKey] = true;
      continue;
    }
    out[deptKey] = apiPublishByDept[deptKey] === true;
  }
  return out;
}

export function applyAuditVisibilityToSections(sections, effectivePublishByDept = {}) {
  if (!Array.isArray(sections)) return [];
  return sections.map((section) => {
    const visible = effectivePublishByDept[section.deptKey] === true;
    if (visible) return { ...section, isPublishedToReport: true };
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

function sopRowsDigest(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return rows
    .map(
      (r) =>
        `${r.no}|${r.sopRelated}|${r.reviewComment}|${r.auditeeComment}|${r.followUpDetail}|${r.status}`,
    )
    .join(";");
}

function htmlDigest(html) {
  return crypto
    .createHash("sha256")
    .update(String(html || "").trim())
    .digest("hex")
    .slice(0, 8);
}

/** Hash of preview content — regenerate OnlyOffice DOCX when module or narrative changes. */
export function computePreviewSnapshotHash(
  auditVisibleByDept = {},
  findingSections = [],
  narrative = {},
) {
  const payload = {
    visibility: auditVisibleByDept,
    exec: htmlDigest(narrative.executiveSummaryHtml),
    objectives: htmlDigest(narrative.auditObjectivesScopeHtml),
    approach: htmlDigest(narrative.auditApproachMethodologyHtml),
    conclusions: narrative.conclusionValues || {},
    depts: (findingSections || []).map((s) => ({
      k: s.deptKey,
      sopN: (s.sopRows || []).length,
      sopD: sopRowsDigest(s.sopRows),
      audit: (s.auditRows || []).length,
      exec: s.executiveSummary ? 1 : 0,
    })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}
