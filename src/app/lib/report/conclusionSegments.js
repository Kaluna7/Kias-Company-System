import { REPORT_DEPARTMENTS } from "./reportDepartments";

const DEPT_LABEL_BY_KEY = Object.fromEntries(
  REPORT_DEPARTMENTS.map((d) => [d.key, d.label]),
);

/** Satu blok teks per departemen (tidak dipecah per paragraf). */
export function buildConclusionDeptSegments(deptSections, conclusionValues) {
  return (deptSections || [])
    .map((section, index) => ({
      deptKey: section.deptKey,
      deptLabel: section.deptLabel,
      sectionNumber: index + 1,
      text: String(conclusionValues?.[section.deptKey] ?? "").trim(),
      showHeader: true,
    }))
    .filter((seg) => seg.text);
}

function deptLabelForKey(deptKey, sections = []) {
  const fromSection = sections.find((s) => s.deptKey === deptKey);
  if (fromSection?.deptLabel) return fromSection.deptLabel;
  return DEPT_LABEL_BY_KEY[deptKey] || deptKey;
}

function sectionNumberForKey(deptKey, sections = [], deptIndexMap = {}) {
  if (Number.isFinite(deptIndexMap[deptKey])) return deptIndexMap[deptKey];
  const idx = sections.findIndex((s) => s.deptKey === deptKey);
  if (idx >= 0) return idx + 1;
  const orderIdx = REPORT_DEPARTMENTS.findIndex((d) => d.key === deptKey);
  return orderIdx >= 0 ? orderIdx + 1 : 1;
}

/**
 * Build conclusion page segments for DOCX from payload (preview export or DB).
 * @param {object} payload
 * @returns {Array<Array<{ deptKey, deptLabel, sectionNumber, text, showHeader? }>>}
 */
export function resolveConclusionPagesFromPayload(payload = {}) {
  const saved = payload.conclusionPages;
  if (Array.isArray(saved) && saved.length > 0) {
    const normalized = saved
      .map((page) =>
        (Array.isArray(page) ? page : [])
          .map((seg) => ({
            deptKey: seg.deptKey,
            deptLabel: seg.deptLabel,
            sectionNumber: seg.sectionNumber,
            text: String(seg.text ?? "").trim(),
            showHeader: seg.showHeader !== false,
            chunkIndex: seg.chunkIndex,
          }))
          .filter((seg) => seg.text),
      )
      .filter((page) => page.length > 0);
    if (normalized.length > 0) return normalized;
  }

  const conclusionValues =
    payload.conclusionValues && typeof payload.conclusionValues === "object"
      ? payload.conclusionValues
      : {};
  const sections = Array.isArray(payload.findingSections) ? payload.findingSections : [];
  const deptIndexMap = payload.deptIndexMap || {};

  const keysWithText = Object.keys(conclusionValues).filter((k) =>
    String(conclusionValues[k] ?? "").trim(),
  );

  if (keysWithText.length > 0) {
    const segments = keysWithText.map((deptKey) => ({
      deptKey,
      deptLabel: deptLabelForKey(deptKey, sections),
      sectionNumber: sectionNumberForKey(deptKey, sections, deptIndexMap),
      text: String(conclusionValues[deptKey]).trim(),
      showHeader: true,
    }));
    return segments.length > 0 ? [segments] : [];
  }

  const fromSections = sections
    .map((section, i) => ({
      deptKey: section.deptKey,
      deptLabel: section.deptLabel,
      sectionNumber: deptIndexMap[section.deptKey] ?? i + 1,
      text: String(section.conclusionText ?? "").trim(),
      showHeader: true,
    }))
    .filter((seg) => seg.text);

  return fromSections.length > 0 ? [fromSections] : [];
}
