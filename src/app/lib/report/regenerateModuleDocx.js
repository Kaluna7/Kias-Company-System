import { readMeta, docxExists, readDocx } from "./documentStore";
import { refreshHubModulesForRegen } from "./refreshHubModulesForRegen";
import { buildPayloadFromPapers } from "./buildPayloadFromPapers";
import { enrichRegeneratePayloadWithOnlyOffice } from "./enrichRegeneratePayload";
import { createReportSession } from "./reportService";
import { ensureLatestDocxOnDisk } from "./ensureLatestDocxOnDisk";
import {
  regenerateFindingsPaperInDocx,
  finalizeFindingsBlockSync,
} from "./regenerateFindingsPaper";

/**
 * Sync modul → patch HANYA paper Findings & Recommendations.
 * Paper lain tidak di-reset.
 */
export async function regenerateModuleDocxSafe(
  year,
  sessionId,
  createdBy = {},
  options = {},
) {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    return { ok: false, error: "Invalid year", regenerated: false };
  }

  let filePrep = null;
  if (await docxExists(sessionId)) {
    filePrep = await ensureLatestDocxOnDisk(sessionId, { syncBy: "pre-regen-sync" });
  }

  let refreshed = options.refreshed;
  if (!refreshed?.ok) {
    refreshed = await refreshHubModulesForRegen(
      y,
      options.cookieHeader || "",
      createdBy.email || createdBy.name || createdBy.id || "regen-sync",
    );
  }
  if (!refreshed.ok) {
    return { ok: false, error: refreshed.error || "Could not refresh hub modules", regenerated: false };
  }

  const saved = refreshed.saved;
  let blockSync = refreshed.blockSync;
  if (!saved.findingSections?.length) {
    return { ok: false, error: "No report data for this year", regenerated: false };
  }

  if (await docxExists(sessionId)) {
    blockSync = finalizeFindingsBlockSync(await readDocx(sessionId), blockSync);
    const patch = await regenerateFindingsPaperInDocx(y, sessionId, blockSync, saved, {
      fileBefore: filePrep?.ready,
    });

    if (patch.ok) {
      return {
        ...patch,
        sessionId,
        year: y,
        editorPath: `/Page/report/editor?session=${encodeURIComponent(sessionId)}`,
        preservedUserEdits: true,
        findingsOnly: true,
        bootstrapped: refreshed.bootstrapped === true,
        filePrep,
      };
    }

    if (patch.needsInitialBuild) {
      if (options.allowFullRebuild !== true) {
        return {
          ok: false,
          needsInitialBuild: true,
          regenerated: false,
          patched: false,
          patchMode: "blocked-no-bookmarks",
          error:
            patch.error ||
            "DOCX belum punya struktur findings. Gunakan Create Report sekali (bukan lock/unlock).",
          filePrep,
          ...patch,
        };
      }

      let payload = await buildPayloadFromPapers(y);
      if (!payload) return { ok: false, error: "Could not build payload", regenerated: true };
      payload = await enrichRegeneratePayloadWithOnlyOffice(y, payload);
      const result = await createReportSession(payload, createdBy, {
        sessionId,
        regenerateDocx: true,
      });
      return {
        ok: true,
        sessionId: result.sessionId,
        year: y,
        editorPath: result.editorPath,
        initialBuild: true,
        regenerated: true,
        patched: false,
        patchMode: "full-rebuild",
        findingsOnly: true,
        preservedUserPapers: true,
        filePrep,
      };
    }

    return {
      ok: false,
      error: patch.error || "Findings sync failed",
      regenerated: false,
      patched: false,
      filePrep,
      ...patch,
    };
  }

  let payload = await buildPayloadFromPapers(y);
  if (!payload) return { ok: false, error: "Could not build payload", regenerated: true };
  payload = await enrichRegeneratePayloadWithOnlyOffice(y, payload);
  const result = await createReportSession(payload, createdBy, { sessionId, regenerateDocx: true });
  const meta = await readMeta(sessionId);
  return {
    ok: true,
    sessionId: result.sessionId,
    year: y,
    editorPath: result.editorPath,
    initialBuild: true,
    regenerated: true,
    patched: false,
    patchMode: "full-rebuild",
    moduleTablesHash: meta?.moduleTablesHash,
  };
}
