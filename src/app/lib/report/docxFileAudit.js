import crypto from "crypto";
import fs from "fs";
import { getDocxPath, readMeta } from "./documentStore";

/**
 * Snapshot file DOCX di disk — untuk debug "patch file A vs file B".
 */
export async function readDocxFileAudit(sessionId) {
  const sourceFile = getDocxPath(sessionId);
  try {
    const [buf, stat, meta] = await Promise.all([
      fs.promises.readFile(sourceFile),
      fs.promises.stat(sourceFile),
      readMeta(sessionId),
    ]);
    return {
      sessionId,
      sourceFile,
      targetFile: sourceFile,
      size: buf.length,
      md5: crypto.createHash("md5").update(buf).digest("hex"),
      mtimeMs: stat.mtimeMs,
      lastModified: stat.mtime.toISOString(),
      saveCount: Number(meta?.saveCount) || 0,
      version: Number(meta?.version) || 1,
    };
  } catch (err) {
    return {
      sessionId,
      sourceFile,
      targetFile: sourceFile,
      error: err?.message || String(err),
    };
  }
}

export function logDocxFileAudit(label, audit) {
  console.log(
    `[docx-audit] ${label}`,
    JSON.stringify({
      sourceFile: audit?.sourceFile,
      md5: audit?.md5,
      mtimeMs: audit?.mtimeMs,
      saveCount: audit?.saveCount,
      size: audit?.size,
      error: audit?.error,
    }),
  );
}
