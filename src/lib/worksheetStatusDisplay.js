/**
 * Worksheet status_worksheet: legacy values (COMPLETED, IN PROGRESS) → current labels only.
 */

export function displayWorksheetStatusLabel(raw) {
  const sw = String(raw ?? "").trim();
  if (!sw) return "-";
  const u = sw.toUpperCase();
  if (u === "COMPLETED" || u === "COMPLETE") return "Available";
  if (u === "IN PROGRESS") return "Not Available";
  if (u === "AVAILABLE" || sw === "Available") return "Available";
  if (u === "NOT AVAILABLE" || sw === "Not Available") return "Not Available";
  return sw;
}

export function worksheetStatusReportCellClass(raw) {
  const label = displayWorksheetStatusLabel(raw);
  if (label === "Available") return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-800";
}
