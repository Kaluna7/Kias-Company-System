export const PREPARED_BY_EXAMPLE = {
  name: "Example Name",
  role: "MEMBER",
  date: "31/01/2026",
};

export function formatPreparedByDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).trim();
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** One display/export row — examples when user has not added a member. */
export function resolvePreparedByRow(prepared) {
  const m = (prepared?.length > 0 ? prepared[0] : null) ?? null;
  const name = String(m?.name ?? "").trim();
  const date = formatPreparedByDateInput(m?.date);
  if (!name && !date) return { ...PREPARED_BY_EXAMPLE };
  return {
    name: name || PREPARED_BY_EXAMPLE.name,
    role: String(m?.role || "MEMBER").trim() || "MEMBER",
    date: date || PREPARED_BY_EXAMPLE.date,
  };
}
