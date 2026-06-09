import fs from "fs";
import path from "path";
import { getReportsDir, readMeta, writeMeta, saveDocx, bumpDocumentVersion } from "./documentStore";
import { readReportState, writeReportState } from "./reportStateStore";
import { readPreviewPayload } from "./previewPayloadStore";
import { touchHubRevision } from "./reportPreviewHub";
import { seedPapersFromLegacyState } from "./reportPapers";

const DEFAULT_BACKUP_SESSION = "8b1f0558a99813542a1480a833a75e1d";

/**
 * Pulihkan shared-report-{year}.docx dari backup + narasi dari preview payload / hub.
 */
export async function restoreSharedReportFromBackup(year, options = {}) {
  const y = Number(year);
  const sessionId = options.sessionId || `shared-report-${y}`;
  const backupId = options.backupSessionId || DEFAULT_BACKUP_SESSION;
  const reportsDir = getReportsDir();
  const backupDocx = path.join(reportsDir, `${backupId}.docx`);

  if (!fs.existsSync(backupDocx)) {
    return { ok: false, error: `Backup not found: ${backupDocx}` };
  }

  const buf = await fs.promises.readFile(backupDocx);
  await saveDocx(sessionId, buf);

  const existingMeta = (await readMeta(sessionId)) || {};
  const backupMeta = (await readMeta(backupId)) || {};
  const preview =
    (await readPreviewPayload(sessionId)) ||
    (await readPreviewPayload(backupId)) ||
    null;

  const meta = await bumpDocumentVersion(sessionId);
  await writeMeta(sessionId, {
    ...existingMeta,
    ...backupMeta,
    sessionId,
    year: y,
    version: Number(meta.version || existingMeta.version || 1) + 1,
    saveCount: 0,
    title: `KIAS-Consolidated-Report-${y}.docx`,
    updatedAt: new Date().toISOString(),
    restoredFrom: backupId,
    restoredAt: new Date().toISOString(),
  });

  const hub = (await readReportState(y)) || {};
  const narrative = preview || {};
  const papers = seedPapersFromLegacyState({
    ...hub,
    executiveSummaryHtml: narrative.executiveSummaryHtml || hub.executiveSummaryHtml,
    auditObjectivesScopeHtml: narrative.auditObjectivesScopeHtml || hub.auditObjectivesScopeHtml,
    auditApproachMethodologyHtml:
      narrative.auditApproachMethodologyHtml || hub.auditApproachMethodologyHtml,
    conclusionValues: narrative.conclusionValues || hub.conclusionValues,
    appendices: narrative.appendices || hub.appendices,
    wordFrontMatterHtml: narrative.wordFrontMatterHtml || hub.wordFrontMatterHtml,
    wordAppendicesHtml: narrative.wordAppendicesHtml || hub.wordAppendicesHtml,
  });

  const nextHub = touchHubRevision({
    ...hub,
    executiveSummaryHtml: narrative.executiveSummaryHtml || hub.executiveSummaryHtml || "",
    auditObjectivesScopeHtml: narrative.auditObjectivesScopeHtml || hub.auditObjectivesScopeHtml || "",
    auditApproachMethodologyHtml:
      narrative.auditApproachMethodologyHtml || hub.auditApproachMethodologyHtml || "",
    conclusionValues: narrative.conclusionValues || hub.conclusionValues || {},
    appendices: narrative.appendices || hub.appendices || [],
    auditVisibleByDept: narrative.auditVisibleByDept || hub.auditVisibleByDept || {},
    findingSections: narrative.findingSections || hub.findingSections || [],
    reportPapers: papers,
    restoredFromBackup: backupId,
    restoredAt: new Date().toISOString(),
  });

  await writeReportState(y, nextHub, options.updatedBy || "restore-backup");

  return {
    ok: true,
    sessionId,
    year: y,
    backupSessionId: backupId,
    docxBytes: buf.length,
    editorPath: `/Page/report/editor?session=${encodeURIComponent(sessionId)}`,
  };
}
