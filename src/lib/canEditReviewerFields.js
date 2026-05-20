/** Admin and reviewer may edit reviewer name, date, status, and related header fields. */
export function canEditReviewerFields(role) {
  const r = String(role ?? "").toLowerCase();
  return r === "admin" || r === "reviewer";
}
