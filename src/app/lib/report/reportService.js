/**
 * Report Service — single entry for DOCX-first consolidated reports.
 *
 * Module A/B/C → snapshot payload → generate DOCX → store → ONLYOFFICE → download / PDF
 *
 * @see ./ARCHITECTURE.md
 */

import { generateReportDocx, getReportDocxEngine } from "./docx/generateReportDocx";
import {
  createSessionId,
  saveDocx,
  writeMeta,
  readMeta,
  readDocx,
  docxExists,
  getDocxPath,
} from "./documentStore";
import { isOnlyOfficeEnabled } from "./onlyoffice/jwt";
import { checkOnlyOfficeDocumentServer } from "./onlyoffice/health";
import { convertDocxToPdfViaOnlyOffice } from "./onlyoffice/convertToPdf";
import { convertDocxToPdf } from "./libreOffice";
import { computeAuditReviewSnapshotHash } from "./auditReviewSnapshotHash";
import { computeModuleTablesHash } from "./moduleTablesHash";
import { filterReportPayloadForPublish } from "./filterFindingSectionsForReport";
import { savePreviewPayload } from "./previewPayloadStore";
import { enrichRegeneratePayloadWithOnlyOffice } from "./enrichRegeneratePayload";
import { getReportResetGeneration } from "./reportResetGeneration";
import fs from "fs";
import path from "path";
import os from "os";

export { generateReportDocx, getReportDocxEngine } from "./docx/generateReportDocx";
export { REPORT_PIPELINE_STEPS } from "./reportPipeline";
export const REPORT_TEMPLATE_VERSION = "2026-06-03-audit-table-col-widths-v5";

/**
 * @param {object} payload Consolidated report snapshot
 * @returns {Promise<Buffer>}
 */
export async function buildReportDocxBuffer(payload) {
  return generateReportDocx(payload);
}

/**
 * Generate DOCX, persist to data/reports/, return session metadata.
 * @param {object} payload
 * @param {{ id?: string, name?: string, email?: string }} createdBy
 * @param {{ sessionId?: string, bumpVersion?: boolean }} options — bumpVersion only after Reset
 */
export async function createReportSession(payload, createdBy = {}, options = {}) {
  const year = payload?.year ?? new Date().getFullYear();
  const sessionId = options?.sessionId || createSessionId();
  const existingMeta = await readMeta(sessionId);
  const bumpVersion = options.bumpVersion === true;
  const bumpDocumentKey = options.bumpDocumentKey === true;
  const regenerateDocx = options.regenerateDocx === true || bumpVersion;
  const resetGeneration = await getReportResetGeneration(year);
  const usePayloadAsIs =
    payload?.source === "html-preview" ||
    payload?.source === "database" ||
    payload?._narrativeSource === "database";
  let publishPayload = usePayloadAsIs
    ? payload
    : await filterReportPayloadForPublish(payload);
  if (
    regenerateDocx &&
    !usePayloadAsIs &&
    publishPayload?._narrativeSource !== "database"
  ) {
    publishPayload = await enrichRegeneratePayloadWithOnlyOffice(year, publishPayload);
  }
  const docxBuffer = await buildReportDocxBuffer(publishPayload);

  await saveDocx(sessionId, docxBuffer);
  /** Version advances only on explicit bumpVersion (Reset flow) — not on each Create rebuild. */
  const nextVersion = existingMeta
    ? bumpVersion
      ? Number(existingMeta.version || 0) + 1
      : Number(existingMeta.version || 1)
    : 1;
  /** saveCount advances on OnlyOffice close, or on HTML Preview → Word rebuild (new document.key). */
  const nextSaveCount = bumpVersion
    ? 0
    : bumpDocumentKey
      ? Number(existingMeta?.saveCount || 0) + 1
      : Number(existingMeta?.saveCount || 0);
  let docxMtimeMs = Date.now();
  try {
    const stat = await fs.promises.stat(getDocxPath(sessionId));
    docxMtimeMs = stat.mtimeMs;
  } catch {
    /* ignore */
  }
  await savePreviewPayload(sessionId, publishPayload);
  await writeMeta(sessionId, {
    sessionId,
    year,
    version: nextVersion,
    saveCount: nextSaveCount,
    resetGeneration,
    docxMtimeMs,
    templateVersion: REPORT_TEMPLATE_VERSION,
    /** Hash of preview when this DOCX was generated — used to detect stale Word vs HTML preview. */
    previewSnapshotHash: publishPayload.previewSnapshotHash || null,
    previewDocxRevision:
      options.bumpPreviewDocxRevision === true ||
      (regenerateDocx && publishPayload?.source === "html-preview")
        ? Number(existingMeta?.previewDocxRevision || 0) + 1
        : Number(existingMeta?.previewDocxRevision || 0),
    coverSnapshotHash: publishPayload.coverSnapshotHash || null,
    moduleTablesHash: computeModuleTablesHash(publishPayload.findingSections || []),
    onlyOfficeSyncRevision: existingMeta
      ? Number(existingMeta?.onlyOfficeSyncRevision) || 0
      : 0,
    auditReviewSnapshotHash: computeAuditReviewSnapshotHash(publishPayload),
    docxEngine: getReportDocxEngine(),
    title: `KIAS-Consolidated-Report-${year}.docx`,
    createdAt: existingMeta?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: {
      id: existingMeta?.createdBy?.id || createdBy.id || createdBy.email || "user",
      name: existingMeta?.createdBy?.name || createdBy.name || createdBy.email || "KIAS User",
    },
  });

  let onlyOfficeReachable = false;
  let onlyOfficeDetail = null;

  if (isOnlyOfficeEnabled()) {
    const health = await checkOnlyOfficeDocumentServer();
    onlyOfficeReachable = health.ok;
    onlyOfficeDetail = health.ok ? null : health.detail;
    if (!health.ok) {
      console.warn("[reportService] OnlyOffice not reachable:", health.publicUrl, health.detail);
    }
  }

  return {
    sessionId,
    year,
    docxEngine: getReportDocxEngine(),
    editorEnabled: isOnlyOfficeEnabled(),
    onlyOfficeReachable,
    onlyOfficeDetail,
    editorPath: `/Page/report/editor?session=${encodeURIComponent(sessionId)}`,
  };
}

/**
 * Direct export without storing a session (preview download / legacy).
 * @param {object} payload
 * @param {"docx"|"pdf"} format
 */
export async function exportReportDirect(payload, format = "docx") {
  const publishPayload = await filterReportPayloadForPublish(payload);
  const docxBuffer = await buildReportDocxBuffer(publishPayload);
  const year = publishPayload?.year ?? new Date().getFullYear();

  if (format === "docx") {
    return { buffer: docxBuffer, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", year };
  }

  if (format === "pdf") {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "kias-report-"));
    const docxPath = path.join(tmpDir, `report-${year}.docx`);
    const pdfPath = path.join(tmpDir, `report-${year}.pdf`);
    try {
      await fs.promises.writeFile(docxPath, docxBuffer);
      await convertDocxToPdf(docxPath, tmpDir);
      const pdfBuffer = await fs.promises.readFile(pdfPath);
      return { buffer: pdfBuffer, contentType: "application/pdf", year };
    } finally {
      fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  throw new Error("Invalid format. Use docx or pdf.");
}

/**
 * Download from stored session (post–ONLYOFFICE edit).
 * @param {string} sessionId
 * @param {"docx"|"pdf"} format
 */
export async function exportStoredSession(sessionId, format = "docx") {
  if (!(await docxExists(sessionId))) {
    throw new Error("Document not found");
  }

  const meta = await readMeta(sessionId);
  const year = meta?.year ?? new Date().getFullYear();

  if (format === "docx") {
    const buffer = await readDocx(sessionId);
    return { buffer, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", year };
  }

  if (format === "pdf") {
    let pdfBuffer = null;
    if (isOnlyOfficeEnabled()) {
      try {
        pdfBuffer = await convertDocxToPdfViaOnlyOffice(sessionId);
      } catch (err) {
        console.warn("[reportService] OnlyOffice PDF failed, trying LibreOffice:", err?.message);
      }
    }

    if (!pdfBuffer) {
      const docxBuffer = await readDocx(sessionId);
      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "kias-report-pdf-"));
      const docxPath = path.join(tmpDir, "report.docx");
      try {
        await fs.promises.writeFile(docxPath, docxBuffer);
        const pdfPath = await convertDocxToPdf(docxPath, tmpDir);
        pdfBuffer = await fs.promises.readFile(pdfPath);
      } finally {
        fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    return { buffer: pdfBuffer, contentType: "application/pdf", year };
  }

  throw new Error("Invalid format. Use docx or pdf.");
}

