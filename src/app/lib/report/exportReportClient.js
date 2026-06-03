/**
 * Client helpers — DOCX-first report pipeline (see lib/report/ARCHITECTURE.md).
 *
 * Module data → POST /api/report/session → ONLYOFFICE editor → download DOCX/PDF
 */

/**
 * Generate DOCX from module data and open OnlyOffice editor.
 * @returns {Promise<{ ok: boolean, sessionId?: string, editorPath?: string, error?: string }>}
 */
/**
 * @param {object} payload Report snapshot
 * @param {{ forceRegenerate?: boolean }} [options] Pass forceRegenerate after explicit reset / template regen only
 */
export async function createReportEditorSession(payload, options = {}) {
  const res = await fetch("/api/report/session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      // Shared session per year — all users co-edit the same DOCX in OnlyOffice.
      reuseExistingSession: true,
      forceRegenerateSession: options.forceRegenerate === true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { ok: false, error: data.error || `Session failed (${res.status})` };
  }
  return {
    ok: true,
    sessionId: data.sessionId,
    year: data.year,
    editorPath: data.editorPath,
    editorEnabled: data.editorEnabled,
    onlyOfficeReachable: data.onlyOfficeReachable === true,
    onlyOfficeDetail: data.onlyOfficeDetail || null,
  };
}

/**
 * Download DOCX/PDF from an existing report session (no OnlyOffice required).
 */
export async function downloadReportSession(sessionId, format = "docx", year) {
  const fmt = format === "pdf" ? "pdf" : "docx";
  const res = await fetch(
    `/api/report/documents/${encodeURIComponent(sessionId)}/download?format=${fmt}`,
    { credentials: "include" },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || `Download failed (${res.status})` };
  }
  const blob = await res.blob();
  const y = year ?? new Date().getFullYear();
  const fallback = `KIAS-Consolidated-Report-${y}.${fmt === "pdf" ? "pdf" : "docx"}`;
  const filename =
    parseFilenameFromDisposition(res.headers.get("Content-Disposition")) || fallback;
  triggerBlobDownload(blob, filename);
  return { ok: true };
}

/**
 * Direct download without editor (legacy / fallback).
 */

function parseFilenameFromDisposition(header) {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(header);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1].replace(/"/g, "").trim());
  } catch {
    return match[1].replace(/"/g, "").trim();
  }
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * @param {object} payload Report snapshot from preview page
 * @param {"docx"|"pdf"} format
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function downloadConsolidatedReport(payload, format = "docx") {
  const fmt = format === "pdf" ? "pdf" : "docx";
  const res = await fetch(`/api/report/export?format=${fmt}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error || `Export failed (${res.status})` };
  }

  const blob = await res.blob();
  const year = payload?.year ?? new Date().getFullYear();
  const fallback = `KIAS-Consolidated-Report-${year}.${fmt === "pdf" ? "pdf" : "docx"}`;
  const filename =
    parseFilenameFromDisposition(res.headers.get("Content-Disposition")) || fallback;
  triggerBlobDownload(blob, filename);
  return { ok: true };
}
