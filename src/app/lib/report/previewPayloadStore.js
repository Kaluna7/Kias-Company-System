import fs from "fs";
import path from "path";
import { getReportsDir } from "./documentStore";

export function getPreviewPayloadPath(sessionId) {
  return path.join(getReportsDir(), `${sessionId}.preview.json`);
}

export async function savePreviewPayload(sessionId, payload) {
  const filePath = getPreviewPayloadPath(sessionId);
  const slim = {
    source: "html-preview",
    year: payload?.year,
    previewSnapshotHash: payload?.previewSnapshotHash,
    auditVisibleByDept: payload?.auditVisibleByDept || {},
    executiveSummaryHtml: payload?.executiveSummaryHtml,
    auditObjectivesScopeHtml: payload?.auditObjectivesScopeHtml,
    auditApproachMethodologyHtml: payload?.auditApproachMethodologyHtml,
    conclusionValues: payload?.conclusionValues,
    appendices: payload?.appendices,
    findingSections: payload?.findingSections,
    savedAt: new Date().toISOString(),
  };
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
