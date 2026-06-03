/** Max calendar year from audit-finding completion / update timestamps. */
export function maxYearFromFindingDates(findings) {
  if (!Array.isArray(findings) || findings.length === 0) return null;
  const years = findings
    .map((row) => row?.completion_date || row?.updated_at || null)
    .filter(Boolean)
    .map((value) => {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d.getFullYear();
    })
    .filter((y) => y != null);
  if (years.length === 0) return null;
  return Math.max(...years);
}

function yearFromDateString(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

/**
 * Single audit_year for audit-review GET/POST (findings + executive summary).
 * URL ?year= wins; else max finding year; else period end/start; else schedule; else current year.
 */
export function resolveAuditReviewYear({
  selectedYear = null,
  findings = [],
  auditPeriodEnd = "",
  auditPeriodStart = "",
  scheduleYear = null,
} = {}) {
  if (Number.isInteger(selectedYear)) return selectedYear;

  const fromFindings = maxYearFromFindingDates(findings);
  if (fromFindings != null) return fromFindings;

  const fromEnd = yearFromDateString(auditPeriodEnd);
  if (fromEnd != null) return fromEnd;

  const fromStart = yearFromDateString(auditPeriodStart);
  if (fromStart != null) return fromStart;

  if (Number.isInteger(scheduleYear)) return scheduleYear;

  return new Date().getFullYear();
}
