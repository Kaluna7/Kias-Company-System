/**
 * Clip schedule ranges to an audit calendar year (aligned with dashboard progress).
 */

export function buildWindowFromSchedule(schedule, year) {
  if (!schedule?.start_date || !schedule?.end_date) return null;

  let start = schedule.start_date instanceof Date ? schedule.start_date : new Date(schedule.start_date);
  let end = schedule.end_date instanceof Date ? schedule.end_date : new Date(schedule.end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  if (year != null && Number.isFinite(year)) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    if (end < yearStart || start > yearEnd) return null;
    if (start < yearStart) start = yearStart;
    if (end > yearEnd) end = yearEnd;
  }

  return { start, end };
}

/** YYYY-MM-DD using local calendar (matches Date(year, 0, 1) clipping). */
export function dateToLocalYmd(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
