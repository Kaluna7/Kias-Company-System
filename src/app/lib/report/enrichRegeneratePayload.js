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

/** Saat user sudah edit OnlyOffice — Word adalah sumber narasi, bukan HTML preview lama. */
function mergeHtmlFieldPreferWord(existing, fromWord) {
  const word = String(fromWord ?? "").trim();
  if (word) return fromWord;
  return existing ?? "";
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

  let next =
    rev > 0
      ? buildPersistPayloadWithProtectedNarrative({
          dbState: saved,
          tablesPayload: payload,
          onlyOfficeSyncRevision: rev,
        })
      : { ...payload, ...saved, findingSections: payload.findingSections || saved.findingSections };

  const sessionId = `shared-report-${y}`;
  if (await docxExists(sessionId)) {
    try {
      const docxBuffer = await readDocx(sessionId);
      const extracted = await extractPreviewStateFromDocx(docxBuffer, {
        findingSections: next.findingSections || saved.findingSections,
        conclusionValues: next.conclusionValues || saved.conclusionValues,
      });
      if (extracted.ok) {
        const preferWord = rev > 0;
        const mergeHtml = preferWord ? mergeHtmlFieldPreferWord : mergeHtmlFieldPreferDb;
        const hasWordNarrative =
          String(extracted.executiveSummaryHtml || "").trim() ||
          String(extracted.wordFindingsHtml || "").trim() ||
          String(extracted.wordFrontMatterHtml || "").trim();
        const mergeHtmlResolved =
          !preferWord && hasWordNarrative ? mergeHtmlFieldPreferWord : mergeHtml;
        next = {
          ...next,
          executiveSummaryHtml: mergeHtmlResolved(
            next.executiveSummaryHtml,
            extracted.executiveSummaryHtml,
          ),
          auditObjectivesScopeHtml: mergeHtmlResolved(
            next.auditObjectivesScopeHtml,
            extracted.auditObjectivesScopeHtml,
          ),
          auditApproachMethodologyHtml: mergeHtmlResolved(
            next.auditApproachMethodologyHtml,
            extracted.auditApproachMethodologyHtml,
          ),
          conclusionValues: preferWord || hasWordNarrative
            ? { ...(extracted.conclusionValues || {}), ...(next.conclusionValues || {}) }
            : { ...(next.conclusionValues || {}), ...(extracted.conclusionValues || {}) },
          wordFindingsHtml: mergeHtmlResolved(next.wordFindingsHtml, extracted.wordFindingsHtml),
          wordAppendicesHtml: mergeHtmlResolved(next.wordAppendicesHtml, extracted.wordAppendicesHtml),
          wordFrontMatterHtml: mergeHtmlResolved(
            next.wordFrontMatterHtml,
            extracted.wordFrontMatterHtml,
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
