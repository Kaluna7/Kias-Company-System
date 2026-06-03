import { readDocx, docxExists } from "./documentStore";
import { readReportState } from "./reportStateStore";
import { buildPersistPayloadWithProtectedNarrative } from "./mergeReportStateForPersist";
import { extractPreviewStateFromDocx } from "./docx/docxToPreviewState";

/** Keep DB / OnlyOffice-synced HTML; only use Word extract when DB field is empty. */
function mergeHtmlFieldPreferDb(existing, fromWord) {
  const prev = String(existing ?? "").trim();
  if (prev) return existing ?? "";
  const word = String(fromWord ?? "").trim();
  return word || existing || "";
}

/**
 * When rebuilding DOCX (module refresh / lock-unlock), keep OnlyOffice narrative
 * from DB + existing shared DOCX — not empty HTML preview defaults.
 */
export async function enrichRegeneratePayloadWithOnlyOffice(year, payload) {
  const y = Number(year);
  if (!Number.isFinite(y)) return payload;

  const saved = (await readReportState(y)) || {};
  const rev = Number(saved.onlyOfficeSyncRevision) || 0;
  if (rev <= 0) return payload;

  let next = buildPersistPayloadWithProtectedNarrative({
    dbState: saved,
    tablesPayload: payload,
    onlyOfficeSyncRevision: rev,
  });

  const sessionId = `shared-report-${y}`;
  if (await docxExists(sessionId)) {
    try {
      const docxBuffer = await readDocx(sessionId);
      const extracted = await extractPreviewStateFromDocx(docxBuffer, {
        findingSections: next.findingSections || saved.findingSections,
        conclusionValues: next.conclusionValues || saved.conclusionValues,
      });
      if (extracted.ok) {
        next = {
          ...next,
          executiveSummaryHtml: mergeHtmlFieldPreferDb(
            next.executiveSummaryHtml,
            extracted.executiveSummaryHtml,
          ),
          auditObjectivesScopeHtml: mergeHtmlFieldPreferDb(
            next.auditObjectivesScopeHtml,
            extracted.auditObjectivesScopeHtml,
          ),
          auditApproachMethodologyHtml: mergeHtmlFieldPreferDb(
            next.auditApproachMethodologyHtml,
            extracted.auditApproachMethodologyHtml,
          ),
          conclusionValues: {
            ...(next.conclusionValues || {}),
            ...(extracted.conclusionValues || {}),
          },
          wordFindingsHtml: mergeHtmlFieldPreferDb(next.wordFindingsHtml, extracted.wordFindingsHtml),
          wordAppendicesHtml: mergeHtmlFieldPreferDb(
            next.wordAppendicesHtml,
            extracted.wordAppendicesHtml,
          ),
          onlyOfficeSyncRevision: rev,
          onlyOfficeSyncedAt: saved.onlyOfficeSyncedAt ?? next.onlyOfficeSyncedAt,
          onlyOfficeSessionId: saved.onlyOfficeSessionId ?? next.onlyOfficeSessionId,
        };
      }
    } catch (err) {
      console.warn("[enrichRegeneratePayload] DOCX extract:", err);
    }
  }

  return next;
}
