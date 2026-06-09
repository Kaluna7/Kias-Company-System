import fs from "fs";
import path from "path";
import { getReportsDir } from "./documentStore";

function resetGenPath(year) {
  return path.join(getReportsDir(), `.reset-gen-${Number(year)}.json`);
}

/** Bump generation so OnlyOffice document.key changes after Reset. */
export async function incrementReportResetGeneration(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return 0;

  let generation = 0;
  try {
    const raw = await fs.promises.readFile(resetGenPath(y), "utf8");
    const parsed = JSON.parse(raw);
    generation = Number(parsed?.generation) || 0;
  } catch {
    /* first reset */
  }

  generation += 1;
  await fs.promises.writeFile(
    resetGenPath(y),
    JSON.stringify({ generation, at: new Date().toISOString() }, null, 2),
    "utf8",
  );
  return generation;
}

export async function getReportResetGeneration(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return 0;
  try {
    const raw = await fs.promises.readFile(resetGenPath(y), "utf8");
    const parsed = JSON.parse(raw);
    return Number(parsed?.generation) || 0;
  } catch {
    return 0;
  }
}
