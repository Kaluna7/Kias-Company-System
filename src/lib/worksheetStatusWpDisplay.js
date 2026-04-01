/**
 * STATUS WP worksheet: Not Checked | Checked | Reject (+ empty / unknown).
 */

function norm(status) {
  const t = String(status ?? "").trim();
  if (t === "Reject") return "reject";
  if (t === "Checked") return "checked";
  if (t === "Not Checked") return "notChecked";
  return "empty";
}

/** Pill / table cell (filled background). */
export function worksheetStatusWpBadgeClass(status) {
  switch (norm(status)) {
    case "reject":
      return "bg-red-100 text-red-900 font-semibold ring-1 ring-inset ring-red-200";
    case "checked":
      return "bg-emerald-100 text-emerald-900 font-semibold ring-1 ring-inset ring-emerald-200";
    case "notChecked":
      return "bg-amber-100 text-amber-950 font-semibold ring-1 ring-inset ring-amber-200";
    default:
      return "bg-slate-100 text-slate-600 font-medium ring-1 ring-inset ring-slate-200";
  }
}

const selectShellBase =
  "w-full rounded-lg px-4 py-2.5 border-2 font-semibold shadow-sm transition-colors";

function statusWpSelectColorClasses(status) {
  switch (norm(status)) {
    case "reject":
      return "bg-red-50 border-red-300 text-red-900 focus:border-red-400 focus:ring-2 focus:ring-red-300 focus:ring-offset-0 focus:outline-none";
    case "checked":
      return "bg-emerald-50 border-emerald-300 text-emerald-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300 focus:ring-offset-0 focus:outline-none";
    case "notChecked":
      return "bg-amber-50 border-amber-300 text-amber-950 focus:border-amber-400 focus:ring-2 focus:ring-amber-300 focus:ring-offset-0 focus:outline-none";
    default:
      return "bg-white border-slate-300 text-slate-700 focus:border-[#141D38] focus:ring-2 focus:ring-[#141D38] focus:ring-offset-0 focus:outline-none";
  }
}

/** Classes for the STATUS WP `select` (editable). */
export function worksheetStatusWpSelectClass(status) {
  return `${selectShellBase} ${statusWpSelectColorClasses(status)}`;
}

/**
 * Read-only STATUS WP box — same colours for all users (preparer sees this instead of a greyed-out `select`).
 */
export function worksheetStatusWpReadOnlyBoxClass(status) {
  return `${selectShellBase} ${statusWpSelectColorClasses(status)} flex items-center min-h-[2.875rem] cursor-default select-none`;
}
