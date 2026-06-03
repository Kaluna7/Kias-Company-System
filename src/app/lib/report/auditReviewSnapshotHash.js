import crypto from "crypto";

/** Fingerprint dept executive summaries + finding counts for session regen. */
export function computeAuditReviewSnapshotHash(payload) {
  const slice = (payload?.findingSections || []).map((section) => ({
    deptKey: section.deptKey,
    executiveSummary: section.executiveSummary ?? null,
    auditCount: Array.isArray(section.auditRows) ? section.auditRows.length : 0,
    sopCount: Array.isArray(section.sopRows) ? section.sopRows.length : 0,
  }));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(slice))
    .digest("hex")
    .slice(0, 24);
}
