export function formatPreparedByDateInput(value) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Parse stored date (ISO or display) back to yyyy-mm-dd for &lt;input type="date"&gt;. */
export function parseDateForHtmlInput(value) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** All prepared-by rows for display/export — append on add, remove only via delete. */
export function resolvePreparedByRows(prepared) {
  if (!Array.isArray(prepared)) return [];
  return prepared
    .map((m) => ({
      name: String(m?.name ?? "").trim(),
      role: String(m?.role || "MEMBER").trim() || "MEMBER",
      date: formatPreparedByDateInput(m?.date),
    }))
    .filter((m) => m.name.length > 0);
}

/** First row only — backward compatible helpers. */
export function resolvePreparedByRow(prepared) {
  const rows = resolvePreparedByRows(prepared);
  if (rows.length === 0) {
    return { name: "", role: "", date: "" };
  }
  return rows[0];
}
