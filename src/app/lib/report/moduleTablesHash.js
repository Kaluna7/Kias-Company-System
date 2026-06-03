import crypto from "crypto";

function sopRowsDigest(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return rows
    .map(
      (r) =>
        `${r.no}|${r.sopRelated}|${r.reviewComment}|${r.auditeeComment}|${r.followUpDetail}|${r.status}`,
    )
    .join(";");
}

function auditRowsDigest(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return rows
    .map(
      (r) =>
        `${r.no}|${r.riskId}|${r.findingDescription}|${r.recommendation}|${r.auditeeComment}|${r.followUpDetail}`,
    )
    .join(";");
}

/** Hash of SOP + audit table content — triggers OnlyOffice DOCX regen when modules change. */
export function computeModuleTablesHash(findingSections = []) {
  const payload = (findingSections || []).map((s) => ({
    k: s.deptKey,
    area: s.areaAudit || "",
    sop: sopRowsDigest(s.sopRows),
    audit: auditRowsDigest(s.auditRows),
    exec: s.executiveSummary ? JSON.stringify(s.executiveSummary) : "",
  }));
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
}
