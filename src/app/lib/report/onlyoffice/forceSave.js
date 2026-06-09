import fs from "fs";
import {
  getOnlyOfficeInternalUrl,
  signOnlyOfficeToken,
  getOnlyOfficeJwtSecret,
  isOnlyOfficeJwtEnabled,
  isOnlyOfficeEnabled,
} from "./jwt";
import { readMeta, getDocumentKey, getDocxPath, docxExists } from "../documentStore";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Minta OnlyOffice Document Server flush edit ke callback → simpan ke disk kita.
 * @see https://api.onlyoffice.com/editors/command/forcesave
 */
export async function requestOnlyOfficeForceSave(sessionId) {
  if (!isOnlyOfficeEnabled()) {
    return { ok: false, reason: "onlyoffice-disabled" };
  }

  const meta = await readMeta(sessionId);
  if (!meta) return { ok: false, reason: "no-meta" };

  const base = getOnlyOfficeInternalUrl();
  if (!base) return { ok: false, reason: "no-onlyoffice-url" };

  const key = getDocumentKey(sessionId, meta);
  const command = { c: "forcesave", key };

  let body = command;
  if (isOnlyOfficeJwtEnabled()) {
    const secret = getOnlyOfficeJwtSecret();
    body = { ...command, token: signOnlyOfficeToken(command, secret) };
  }

  try {
    const res = await fetch(`${base}/coauthoring/CommandService.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    const err = Number(json.error);
    // 0 = saved, 4 = no changes on server (still OK — file already current)
    const ok = err === 0 || err === 4;
    return { ok, error: err, key, raw: json };
  } catch (err) {
    return { ok: false, reason: "fetch-failed", message: err?.message || String(err) };
  }
}

async function waitForDocxMtimeChange(sessionId, previousMtime, maxMs = 8000) {
  const path = getDocxPath(sessionId);
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sleep(350);
    try {
      const stat = await fs.promises.stat(path);
      if (stat.mtimeMs > previousMtime + 0.5) {
        return { ok: true, mtimeMs: stat.mtimeMs };
      }
    } catch {
      /* ignore */
    }
  }
  return { ok: false };
}

/**
 * Sebelum patch/regen modul: pastikan Ctrl+S / edit OnlyOffice sudah ada di file DOCX kita.
 */
export async function flushOnlyOfficeEditsToDisk(sessionId) {
  if (!(await docxExists(sessionId))) {
    return { flushed: false, reason: "no-docx" };
  }

  let prevMtime = 0;
  try {
    const stat = await fs.promises.stat(getDocxPath(sessionId));
    prevMtime = stat.mtimeMs;
  } catch {
    return { flushed: false, reason: "stat-failed" };
  }

  const force = await requestOnlyOfficeForceSave(sessionId);
  if (!force.ok) {
    return {
      flushed: false,
      reason: force.reason || "forcesave-rejected",
      forceSaveError: force.error,
    };
  }

  await sleep(force.error === 0 ? 2500 : 800);

  const waited = await waitForDocxMtimeChange(sessionId, prevMtime);
  return {
    flushed: waited.ok || force.error === 4 || force.ok,
    mtimeChanged: waited.ok,
    forceSaveError: force.error,
    reason: waited.ok ? "mtime-changed" : force.error === 4 ? "no-changes" : "timeout",
  };
}
