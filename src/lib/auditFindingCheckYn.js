/** True when Audit Finding CHECK (Y/N) is affirmative (Yes / Y). */
export function isAuditFindingCheckYes(checkYn) {
  const s = String(checkYn ?? "").trim().toUpperCase();
  return s === "YES" || s === "Y";
}
