/** Client-safe helpers — no Node/pg imports. */

/** Map deptKey → narratives for DOCX / preview payload. */
export function deptFindingNarrativesList(byDept = {}, findingSections = []) {
  const sectionByDept = new Map(
    (Array.isArray(findingSections) ? findingSections : []).map((s) => [s.deptKey, s]),
  );
  const keys = new Set([
    ...Object.keys(byDept || {}),
    ...(findingSections || []).map((s) => s.deptKey),
  ]);
  const list = [];
  for (const deptKey of keys) {
    const row = byDept[deptKey] || {};
    const findingHtml = String(row.findingHtml ?? "").trim();
    const recommendationHtml = String(row.recommendationHtml ?? "").trim();
    if (!findingHtml && !recommendationHtml) continue;
    const section = sectionByDept.get(deptKey);
    list.push({
      deptKey,
      deptLabel: section?.deptLabel || deptKey,
      areaAudit: section?.areaAudit || section?.deptLabel || deptKey,
      findingHtml,
      recommendationHtml,
    });
  }
  return list;
}
