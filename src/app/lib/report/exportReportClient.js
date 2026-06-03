/**
 * Client helpers — DOCX-first report pipeline (see lib/report/ARCHITECTURE.md).
 *
 * Module data → POST /api/report/session → ONLYOFFICE editor → download DOCX/PDF
 */

import { computeModuleTablesHash } from "./moduleTablesHash";

/**
 * Shared OnlyOffice session for a year (join creator's document).
 * @param {number} year
 */
export async function getActiveReportSession(year) {
  const res = await fetch(
    `/api/report/session/active?year=${encodeURIComponent(String(year))}`,
    { credentials: "include", cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return {
      ok: false,
      error: data.error || data.message || `No active session (${res.status})`,
      noSession: data.error === "NO_ACTIVE_SESSION",
    };
  }
  return {
    ok: true,
    sessionId: data.sessionId,
    year: data.year,
    editorPath: data.editorPath,
    createdBy: data.meta?.createdBy ?? data.createdBy ?? null,
    previewSnapshotHash: data.meta?.previewSnapshotHash ?? null,
    moduleTablesHash: data.meta?.moduleTablesHash ?? null,
    onlyOfficeSyncRevision:
      Number(data.onlyOfficeSyncRevision) ||
      Number(data.meta?.onlyOfficeSyncRevision) ||
      0,
    collaborationSession: true,
  };
}

/**
 * Rebuild Word from latest DB module tables (after SOP/Audit edits).
 * @param {number} year
 */
export async function regenerateReportDocxFromModules(year) {
  const res = await fetch("/api/report/session/regenerate-from-modules", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { ok: false, error: data.error || `Regenerate failed (${res.status})` };
  }
  return {
    ok: true,
    sessionId: data.sessionId,
    editorPath: data.editorPath,
    moduleTablesHash: data.moduleTablesHash,
  };
}

/**
 * Generate DOCX from module data and open OnlyOffice editor.
 * @param {object} payload Report snapshot
 * @param {{ forceRegenerate?: boolean, joinOnly?: boolean }} [options]
 */
export async function createReportEditorSession(payload, options = {}) {
  const year = Number(payload?.year ?? new Date().getFullYear());

  if (options.joinOnly) {
    return getActiveReportSession(year);
  }

  const res = await fetch("/api/report/session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      source: payload.source || "html-preview",
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
    joined: data.reusedExistingSession === true,
    createdBy: data.createdBy ?? null,
  };
}

/**
 * Open editor: join existing shared DOCX when possible (collaboration).
 * @param {object} payload
 */
export async function openSharedReportEditor(payload) {
  const year = Number(payload?.year ?? new Date().getFullYear());
  const active = await getActiveReportSession(year);
  const payloadHash = String(payload.previewSnapshotHash || "");

  if (active.ok) {
    const serverHash = String(active.previewSnapshotHash || "");
    const hashMismatch = Boolean(payloadHash) && (!serverHash || payloadHash !== serverHash);
    const payloadModuleHash =
      String(payload.moduleTablesHash || "") ||
      computeModuleTablesHash(payload.findingSections || []);
    const serverModuleHash = String(active.moduleTablesHash || "");
    const moduleMismatch =
      Boolean(payloadModuleHash) &&
      (!serverModuleHash || payloadModuleHash !== serverModuleHash);
    if (!hashMismatch && !moduleMismatch) {
      return {
        ok: true,
        sessionId: active.sessionId,
        editorPath: active.editorPath,
        joined: true,
        createdBy: active.createdBy,
      };
    }

    if (moduleMismatch || hashMismatch) {
      const regen = await regenerateReportDocxFromModules(year);
      if (regen.ok) {
        return {
          ok: true,
          sessionId: active.sessionId,
          editorPath: active.editorPath,
          joined: true,
          createdBy: active.createdBy,
        };
      }
    }

    return createReportEditorSession(payload, { forceRegenerate: true });
  }

  return createReportEditorSession(payload, { forceRegenerate: false });
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

