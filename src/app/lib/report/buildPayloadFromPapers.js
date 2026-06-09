import { buildPayloadFromDb } from "./buildPayloadFromDb";

/**
 * Payload DOCX: narasi USER + Finding/Recommendation dari DB, tabel dari modul.
 */
export async function buildPayloadFromPapers(year, options = {}) {
  const payload = await buildPayloadFromDb(year);
  if (!payload) return null;
  return {
    ...payload,
    preserveUserPapers: options.preserveUserPapers !== false,
  };
}
