import fs from "fs";
import path from "path";
import { getReportsDir } from "./documentStore";

export function getPreviewPayloadPath(sessionId) {
  return path.join(getReportsDir(), `${sessionId}.preview.json`);
}

/** Fields needed to regenerate DOCX identical to HTML Preview. */
const PREVIEW_PERSIST_KEYS = [
  "year",
  "periodStart",
  "periodEnd",
  "issuedDate",
  "auditCoverage",
  "departmentCoverage",
  "area",
  "previewSnapshotHash",
  "coverSnapshotHash",
  "moduleTablesHash",
  "auditTeam",
  "preparedBy",
  "auditCommitteeName",
  "auditCommitteeDate",
  "presidentDirectorName",
  "presidentDirectorDate",
  "auditVisibleByDept",
  "effectivePublishByDept",
  "executiveSummaryHtml",
  "auditObjectivesScopeHtml",
  "auditApproachMethodologyHtml",
  "executiveSummaryPages",
  "auditObjectivesScopePages",
  "auditApproachMethodologyPages",
  "conclusionValues",
  "conclusionChunks",
  "conclusionPages",
  "appendices",
  "appendixPages",
  "findingSections",
  "findingPages",
  "findingDetailPages",
  "selectedFindingByDept",
  "tableOfContents",
  "departmentCompletionRows",
  "deptIndexMap",
  "pageLayout",
];

/** Narrative / visibility only — never overwrite findingPages from DB sync. */
const PREVIEW_NARRATIVE_PATCH_KEYS = [
  "year",
  "previewSnapshotHash",
  "periodStart",
  "periodEnd",
  "auditCoverage",
  "departmentCoverage",
  "area",
  "auditVisibleByDept",
  "effectivePublishByDept",
  "executiveSummaryHtml",
  "auditObjectivesScopeHtml",
  "auditApproachMethodologyHtml",
  "conclusionValues",
  "appendices",
  "auditTeam",
  "preparedBy",
  "auditCommitteeName",
  "auditCommitteeDate",
  "presidentDirectorName",
  "presidentDirectorDate",
];

function pickPreviewPersistFields(payload = {}, existing = null) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  for (const key of PREVIEW_PERSIST_KEYS) {
    if (payload[key] !== undefined) base[key] = payload[key];
  }
  base.source = "html-preview";
  base.savedAt = new Date().toISOString();
  return base;
}

function pickPreviewNarrativePatch(payload = {}, existing = null) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  for (const key of PREVIEW_NARRATIVE_PATCH_KEYS) {
    if (payload[key] !== undefined) base[key] = payload[key];
  }
  base.source = "html-preview";
  base.savedAt = new Date().toISOString();
  return base;
}

/**
 * @param {string} sessionId
 * @param {object} payload
 * @param {{ narrativeOnly?: boolean }} [options] — narrativeOnly: do not replace findingPages from DB
 */
export async function savePreviewPayload(sessionId, payload, options = {}) {
  const filePath = getPreviewPayloadPath(sessionId);
  const existing = await readPreviewPayload(sessionId);
  const slim = options.narrativeOnly
    ? pickPreviewNarrativePatch(payload, existing)
    : pickPreviewPersistFields(payload, existing);
  await fs.promises.writeFile(filePath, JSON.stringify(slim, null, 2), "utf8");
}

export async function readPreviewPayload(sessionId) {
  try {
    const raw = await fs.promises.readFile(getPreviewPayloadPath(sessionId), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function deletePreviewPayload(sessionId) {
  if (!sessionId) return false;
  try {
    await fs.promises.unlink(getPreviewPayloadPath(sessionId));
    return true;
  } catch {
    return false;
  }
}
