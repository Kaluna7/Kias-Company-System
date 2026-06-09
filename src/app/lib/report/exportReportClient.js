/**
 * Client helpers — DOCX-first report pipeline (see lib/report/ARCHITECTURE.md).
 *
 * Module data → POST /api/report/session → ONLYOFFICE editor → download DOCX/PDF
 */

/**
 * Notify all HTML preview tabs that OnlyOffice was opened (auto-join).
 * @param {number} year
 * @param {{ sessionId?: string, editorPath?: string, initiatorClientId?: string }} payload
 */
export async function notifyOnlyOfficeSessionOpened(year, payload = {}) {
  try {
    const res = await fetch("/api/report/collaboration/onlyoffice-opened", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        sessionId: payload.sessionId,
        editorPath: payload.editorPath,
        initiatorClientId: payload.initiatorClientId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.success === true, ...data };
  } catch (err) {
    return { ok: false, error: err?.message || "Notify failed" };
  }
}

/**
 * Who is online + whether OnlyOffice is actively open (WebSocket presence).
 * @param {number} year
 */
export async function getReportCollaborationStatus(year) {
  const res = await fetch(
    `/api/report/collaboration/presence?year=${encodeURIComponent(String(year))}`,
    { credentials: "include", cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return {
      ok: false,
      error: data.error || `Presence check failed (${res.status})`,
      onlyOfficeOpen: false,
      editorPath: null,
      participants: [],
    };
  }
  return {
    ok: true,
    year: data.year,
    onlyOfficeOpen: data.onlyOfficeOpen === true,
    previewOpen: data.previewOpen === true,
    hasDocxSession: data.hasDocxSession === true,
    editorPath: data.editorPath || null,
    participants: Array.isArray(data.participants) ? data.participants : [],
    createdBy: data.createdBy ?? null,
  };
}

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
    coverSnapshotHash: data.meta?.coverSnapshotHash ?? null,
    moduleTablesHash: data.meta?.moduleTablesHash ?? null,
    onlyOfficeSyncRevision:
      Number(data.onlyOfficeSyncRevision) ||
      Number(data.meta?.onlyOfficeSyncRevision) ||
      0,
    collaborationSession: true,
  };
}

/**
 * Rebuild shared DOCX from HTML Preview export only (no database).
 * @param {number} year
 * @param {object} [overlay] Fields from buildReportExportPayload()
 */
export async function syncReportDocxFromPreview(year, overlay = {}) {
  const res = await fetch("/api/report/session/sync-from-preview", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      year: Number(year),
      overlay: overlay && typeof overlay === "object" ? overlay : {},
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { ok: false, error: data.error || `Sync failed (${res.status})` };
  }
  return {
    ok: true,
    sessionId: data.sessionId,
    editorPath: data.editorPath,
    version: data.version,
    conclusionPageCount: data.conclusionPageCount ?? 0,
    appendixPageCount: data.appendixPageCount ?? 0,
  };
}

/**
 * Regenerate DOCX from last saved HTML Preview snapshot (.preview.json) only.
 * @param {number} year
 */
export async function refreshReportDocxFromDb(year) {
  const res = await fetch("/api/report/session/sync-from-preview", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year: Number(year), overlay: {} }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return { ok: false, error: data.error || `Refresh failed (${res.status})` };
  }
  return {
    ok: true,
    sessionId: data.sessionId,
    editorPath: data.editorPath,
    patchMode: "full-regenerate-from-preview-sync",
    narrativeSource: "database",
  };
}

/**
 * @deprecated Prefer refreshReportDocxFromDb — patch merge tidak dipakai lagi.
 * @param {number} year
 */
export async function regenerateReportDocxFromModules(year, options = {}) {
  const sessionId = options.sessionId || `shared-report-${Number(year)}`;
  try {
    await fetch("/api/report/onlyoffice/forcesave", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    /* server also forcesaves — best effort */
  }

  const res = await fetch("/api/report/session/regenerate-from-modules", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return {
      ok: false,
      error: data.error || `Regenerate failed (${res.status})`,
      contentPreservationFailed: data.contentPreservationFailed === true,
      tablesNotInserted: data.tablesNotInserted === true,
    };
  }
  return {
    ok: true,
    sessionId: data.sessionId,
    editorPath: data.editorPath,
    moduleTablesHash: data.moduleTablesHash,
    selectiveDelete: data.selectiveDelete === true,
    selectiveInsert: data.selectiveInsert === true,
    preservedUserEdits: data.preservedUserEdits === true,
    patched: data.patched === true,
    noop: data.noop === true,
    regenerated: data.regenerated === true,
    contentPreservationFailed: data.contentPreservationFailed === true,
    patchMode: data.patchMode || null,
    sourceFile: data.sourceFile || null,
    md5Before: data.md5Before || null,
    md5After: data.md5After || null,
    saveCount: data.saveCount ?? null,
    toInsert: data.toInsert || [],
    toDelete: data.toDelete || [],
    missingInDocx: data.missingInDocx || [],
    error: data.error || null,
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

  const fromPreview = (payload.source || "html-preview") === "html-preview";
  const forceRebuild =
    options.joinOnly !== true &&
    options.resetFindingsOnly !== true &&
    (fromPreview || options.forceRegenerate !== false);

  const res = await fetch("/api/report/session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      source: payload.source || "html-preview",
      reuseExistingSession: true,
      forceRegenerateSession: forceRebuild,
      resetFindingsOnly: options.resetFindingsOnly === true,
      initiatorClientId: payload.initiatorClientId || null,
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
    onlyOfficeReachable:
      data.onlyOfficeReachable === true ||
      (data.onlyOfficeReachable == null && data.editorEnabled !== true),
    onlyOfficeDetail: data.onlyOfficeDetail || null,
    joined: data.reusedExistingSession === true,
    createdBy: data.createdBy ?? null,
  };
}

/**
 * Open editor: join existing shared DOCX when possible (collaboration).
 * @param {object} payload
 */
export async function openSharedReportEditor(payload, options = {}) {
  const year = Number(payload?.year ?? new Date().getFullYear());

  if (options.resetFindingsOnly) {
    return createReportEditorSession(payload, { resetFindingsOnly: true });
  }

  const active = await getActiveReportSession(year);
  const rebuilt = await syncReportDocxFromPreview(year, payload);
  if (rebuilt.ok) {
    return {
      ok: true,
      sessionId: rebuilt.sessionId,
      editorPath: rebuilt.editorPath,
      joined: active.ok,
      createdBy: active.ok ? active.createdBy : null,
    };
  }
  return createReportEditorSession(payload, { forceRegenerate: true });
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

