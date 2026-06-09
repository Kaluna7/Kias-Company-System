import { readReportState } from "./reportStateStore";
import { buildModuleSyncRegeneratePayload } from "./onlyOfficeDocxGuard";
import {
  legacyFieldsFromPapers,
  seedPapersFromLegacyState,
  MODULE_DRIVEN_PAPER,
} from "./reportPapers";
import { pickNarrativeFromReportState } from "./reportStateNarrative";

/**
 * Satu sumber kebenaran: DB (narasi user + modul). Tidak merge dari Word.
 */
export async function buildPayloadFromDb(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return null;

  const saved = (await readReportState(y)) || {};
  const modulePayload = await buildModuleSyncRegeneratePayload(y);
  if (!modulePayload) return null;

  const papers = seedPapersFromLegacyState(saved);
  const narrative = legacyFieldsFromPapers(papers, saved);
  const narrativeFromState = pickNarrativeFromReportState(saved) || {};

  const findingSections = modulePayload.findingSections || saved.findingSections || [];

  return {
    ...modulePayload,
    ...narrative,
    ...narrativeFromState,
    appendices: saved.appendices ?? narrative.appendices ?? [],
    conclusionValues: saved.conclusionValues ?? narrative.conclusionValues ?? {},
    reportPapers: papers,
    deptFindingNarratives: [],
    deptFindingNarrativesByDept: {},
    _findingsSource: MODULE_DRIVEN_PAPER,
    _narrativeSource: "database",
    source: "database",
    preserveUserPapers: true,
  };
}
