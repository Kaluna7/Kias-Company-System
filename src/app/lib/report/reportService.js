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
} from "./documentStore";
import { isOnlyOfficeEnabled } from "./onlyoffice/jwt";
import { checkOnlyOfficeDocumentServer } from "./onlyoffice/health";
import { convertDocxToPdfViaOnlyOffice } from "./onlyoffice/convertToPdf";
import { convertDocxToPdf } from "./libreOffice";
import fs from "fs";
import path from "path";
import os from "os";

export { generateReportDocx, getReportDocxEngine } from "./docx/generateReportDocx";
export { REPORT_PIPELINE_STEPS } from "./reportPipeline";
export const REPORT_TEMPLATE_VERSION = "2026-06-03-date-issued-plain";

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
  const templateStale =
    existingMeta &&
    String(existingMeta.templateVersion || "") !== String(REPORT_TEMPLATE_VERSION);
  const docxBuffer = await buildReportDocxBuffer(payload);

  await saveDocx(sessionId, docxBuffer);
  const nextVersion = existingMeta
    ? bumpVersion
      ? Number(existingMeta.version || 0) + 1
      : Number(existingMeta.version || 1)
    : 1;
  const nextSaveCount = bumpVersion
    ? 0
    : templateStale
      ? Number(existingMeta?.saveCount || 0) + 1
      : Number(existingMeta?.saveCount || 0);
  await writeMeta(sessionId, {
    sessionId,
    year,
    version: nextVersion,
    saveCount: nextSaveCount,
    templateVersion: REPORT_TEMPLATE_VERSION,
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
  const docxBuffer = await buildReportDocxBuffer(payload);
  const year = payload?.year ?? new Date().getFullYear();

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

