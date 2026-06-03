import { sortByRiskId } from "@/app/utils/sortByRiskId";

/** Stable row key for merging audit-finding rows with saved audit-review JSON. */
export function getReviewFindingIdentity(finding) {
  const apNo = String(finding?.apNo || finding?.ap_code || finding?.apCode || "")
    .trim()
    .toLowerCase();
  if (apNo) return `ap::${apNo}`;
  const riskId = String(finding?.riskId || finding?.risk_id || "")
    .trim()
    .toLowerCase();
  return `risk::${riskId}`;
}

/** Map audit-finding API / DB row into audit-review table shape before normalize. */
export function mapAuditFindingToKeyFindingRow(finding, idx = 0) {
  const riskVal = finding?.risk ?? finding?.riskLevel ?? finding?.risk_level;
  return {
    ...finding,
    no: finding?.no ?? idx + 1,
    riskId: finding?.riskId || finding?.risk_id || "",
    riskDetails:
      finding?.riskDetails || finding?.risk_details || finding?.risk_description || "",
    apNo: finding?.apNo || finding?.ap_code || finding?.apCode || "",
    substantiveTest: finding?.substantiveTest || finding?.substantive_test || "",
    checkYn: finding?.checkYn || finding?.check_yn || "",
    method: finding?.method || "",
    risk: riskVal != null && riskVal !== "" ? String(riskVal) : "",
    preparer: finding?.preparer || "",
    findingResult: finding?.findingResult || finding?.finding_result || "",
    findingDescription:
      finding?.findingDescription || finding?.finding_description || "",
    recommendation: finding?.recommendation || "",
    status: finding?.status || finding?.completion_status || "",
    auditee: finding?.auditee || "",
    auditeeComment: finding?.auditeeComment || finding?.auditee_comment || "",
    followUpDetail: finding?.followUpDetail || finding?.follow_up_detail || "",
  };
}

/**
 * Merge completed audit-finding rows with saved audit-review overrides.
 * Saved review row wins for every overlapping column.
 */
export function mergeReviewFindingRows(
  latestFindings = [],
  savedReviewFindings = [],
  normalizeRow,
) {
  const normalizedLatest = Array.isArray(latestFindings)
    ? latestFindings.map((finding, idx) => normalizeRow(mapAuditFindingToKeyFindingRow(finding, idx), idx))
    : [];
  const normalizedSaved = Array.isArray(savedReviewFindings)
    ? savedReviewFindings.map((finding, idx) => normalizeRow(finding, idx))
    : [];

  if (normalizedSaved.length === 0) {
    return sortByRiskId(normalizedLatest);
  }
  if (normalizedLatest.length === 0) {
    return sortByRiskId(normalizedSaved);
  }

  const savedMap = new Map(
    normalizedSaved.map((finding) => [getReviewFindingIdentity(finding), finding]),
  );

  const merged = normalizedLatest.map((finding, idx) => {
    const saved = savedMap.get(getReviewFindingIdentity(finding));
    if (!saved) return finding;
    return normalizeRow({ ...finding, ...saved }, idx);
  });

  const latestKeys = new Set(normalizedLatest.map((f) => getReviewFindingIdentity(f)));
  const savedOnlyRows = normalizedSaved.filter(
    (finding) => !latestKeys.has(getReviewFindingIdentity(finding)),
  );

  return sortByRiskId([...merged, ...savedOnlyRows]);
}
