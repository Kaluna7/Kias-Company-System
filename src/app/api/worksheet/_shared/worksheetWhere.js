/** @param {string|null|undefined} yearParam */
export function yearCreatedAtFilter(yearParam) {
  const y = yearParam ? parseInt(String(yearParam), 10) : NaN;
  if (Number.isNaN(y) || !y) return null;
  return { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
}

/**
 * @param {string} department – e.g. "FINANCE"
 * @param {URLSearchParams} sp
 */
export function buildWorksheetFindManyWhere(department, sp) {
  const where = { department };
  const yf = yearCreatedAtFilter(sp.get("year"));
  if (yf) where.created_at = yf;

  if (sp.get("publishedOnly") === "1") {
    where.published_to_report = true;
  } else if (sp.get("excludePublished") === "1") {
    // `published_to_report` is non-nullable Boolean in Prisma — do not use `null`
    where.published_to_report = false;
  }
  return where;
}

/**
 * Latest draft row for department (optionally year) — uploads / dept page.
 * @param {string} department
 * @param {string|null|undefined} yearParam
 */
export function buildDraftWhereClause(department, yearParam) {
  const where = { department, published_to_report: false };
  const yf = yearCreatedAtFilter(yearParam);
  if (yf) where.created_at = yf;
  return where;
}
