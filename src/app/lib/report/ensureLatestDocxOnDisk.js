import { syncReportStateFromOnlyOfficeSession } from "./syncPreviewFromOnlyOffice";
import { flushOnlyOfficeEditsToDisk } from "./onlyoffice/forceSave";
import { readDocxFileAudit, logDocxFileAudit } from "./docxFileAudit";
import { docxExists } from "./documentStore";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pastikan patch membaca file yang sama dengan hasil Ctrl+S OnlyOffice (bukan versi lama).
 */
export async function ensureLatestDocxOnDisk(sessionId, options = {}) {
  if (!(await docxExists(sessionId))) {
    return { ok: false, reason: "no-docx" };
  }

  const before = await readDocxFileAudit(sessionId);
  logDocxFileAudit("before-flush", before);

  const flush = await flushOnlyOfficeEditsToDisk(sessionId);
  let afterFlush = await readDocxFileAudit(sessionId);

  if (flush.forceSaveError === 0) {
    for (let i = 0; i < 16; i++) {
      await sleep(400);
      afterFlush = await readDocxFileAudit(sessionId);
      if (afterFlush.md5 && afterFlush.md5 !== before.md5) break;
    }
  }

  logDocxFileAudit("after-flush", afterFlush);

  let sync = null;
  try {
    sync = await syncReportStateFromOnlyOfficeSession(sessionId, options.syncBy || "pre-patch-sync");
  } catch (err) {
    sync = { ok: false, error: err?.message || String(err) };
  }

  const ready = await readDocxFileAudit(sessionId);
  logDocxFileAudit("ready-for-patch", ready);

  return {
    ok: true,
    before,
    afterFlush,
    ready,
    flush,
    sync,
    fileChanged: Boolean(before.md5 && ready.md5 && before.md5 !== ready.md5),
  };
}
