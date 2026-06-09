import fs from "fs";
import path from "path";
import crypto from "crypto";
import { deletePreviewPayload } from "./previewPayloadStore";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export function getReportsDir() {
  ensureReportsDir();
  return REPORTS_DIR;
}

export function getDocxPath(sessionId) {
  return path.join(getReportsDir(), `${sessionId}.docx`);
}

export function getMetaPath(sessionId) {
  return path.join(getReportsDir(), `${sessionId}.json`);
}

export function createSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

export async function readMeta(sessionId) {
  const metaPath = getMetaPath(sessionId);
  try {
    const raw = await fs.promises.readFile(metaPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeMeta(sessionId, meta) {
  ensureReportsDir();
  await fs.promises.writeFile(getMetaPath(sessionId), JSON.stringify(meta, null, 2), "utf8");
}

export async function saveDocx(sessionId, buffer) {
  ensureReportsDir();
  await fs.promises.writeFile(getDocxPath(sessionId), buffer);
  const meta = (await readMeta(sessionId)) || { sessionId, version: 1, saveCount: 0 };
  try {
    const stat = await fs.promises.stat(getDocxPath(sessionId));
    meta.docxMtimeMs = stat.mtimeMs;
    meta.updatedAt = new Date().toISOString();
    await writeMeta(sessionId, meta);
  } catch {
    /* ignore */
  }
}

/**
 * Read meta and sync docx mtime only — do NOT bump saveCount here.
 * saveCount changes only on editor close (recordDocumentSave) or new report generation,
 * so the OnlyOffice document.key stays stable during an editing session (no version-changed loop).
 */
export async function syncDocumentKeyForFileChange(sessionId) {
  const meta = (await readMeta(sessionId)) || { sessionId, version: 1, saveCount: 0 };
  try {
    const stat = await fs.promises.stat(getDocxPath(sessionId));
    meta.docxMtimeMs = stat.mtimeMs;
    await writeMeta(sessionId, meta);
  } catch {
    /* docx missing */
  }
  return meta;
}

export async function readDocx(sessionId) {
  return fs.promises.readFile(getDocxPath(sessionId));
}

export async function docxExists(sessionId) {
  try {
    await fs.promises.access(getDocxPath(sessionId), fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function bumpDocumentVersion(sessionId) {
  const meta = (await readMeta(sessionId)) || { sessionId, version: 0 };
  meta.version = Number(meta.version || 0) + 1;
  meta.updatedAt = new Date().toISOString();
  await writeMeta(sessionId, meta);
  return meta;
}

/**
 * OnlyOffice document.key — stable for one editing round; advances on save (saveCount).
 * meta.version only changes on Reset + new generate, not on each Create.
 */
export function getDocumentKey(sessionId, metaOrVersion) {
  if (metaOrVersion != null && typeof metaOrVersion === "object") {
    const g = Number(metaOrVersion.resetGeneration || 0);
    const v = Number(metaOrVersion.version || 1);
    const s = Number(metaOrVersion.saveCount || 0);
    const p = Number(metaOrVersion.previewDocxRevision || 0);
    return `${sessionId}-g${g}-v${v}-s${s}-p${p}`;
  }
  return `${sessionId}-g0-v${metaOrVersion ?? 1}-s0-p0`;
}

/** Server-side DOCX patch (lock/unlock, module tables) — new key so refreshFile loads updated file. */
export async function bumpDocumentKeyAfterServerPatch(sessionId) {
  const meta = (await readMeta(sessionId)) || { sessionId, version: 1, saveCount: 0 };
  meta.saveCount = Number(meta.saveCount || 0) + 1;
  meta.updatedAt = new Date().toISOString();
  await writeMeta(sessionId, meta);
  return meta;
}

/** After OnlyOffice saves — new key on next open without bumping meta.version. */
export async function recordDocumentSave(sessionId) {
  const meta = (await readMeta(sessionId)) || { sessionId, version: 1, saveCount: 0 };
  meta.saveCount = Number(meta.saveCount || 0) + 1;
  meta.updatedAt = new Date().toISOString();
  await writeMeta(sessionId, meta);
  return meta;
}

/**
 * Reuse latest generated report session for the same year so multiple users
 * can open the exact same document in OnlyOffice for co-editing.
 */
export async function findLatestSessionByYear(year) {
  ensureReportsDir();
  const targetYear = Number(year);
  if (!Number.isFinite(targetYear)) return null;

  const entries = await fs.promises.readdir(REPORTS_DIR).catch(() => []);
  let latest = null;

  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const sessionId = name.slice(0, -5);
    const meta = await readMeta(sessionId);
    if (!meta || Number(meta.year) !== targetYear) continue;
    if (!(await docxExists(sessionId))) continue;

    const updatedAt = new Date(meta.updatedAt || meta.createdAt || 0).getTime() || 0;
    if (!latest || updatedAt > latest.updatedAt) {
      latest = { sessionId, updatedAt };
    }
  }

  return latest?.sessionId || null;
}

/** Remove stored DOCX + metadata + cached preview payload for a session. */
export async function deleteReportSession(sessionId) {
  if (!sessionId) return false;
  let removed = false;
  try {
    await fs.promises.unlink(getDocxPath(sessionId));
    removed = true;
  } catch {
    // ignore missing docx
  }
  try {
    await fs.promises.unlink(getMetaPath(sessionId));
    removed = true;
  } catch {
    // ignore missing meta
  }
  if (await deletePreviewPayload(sessionId)) {
    removed = true;
  }
  return removed;
}
