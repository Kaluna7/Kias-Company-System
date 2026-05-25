/**
 * Kunci stabil per baris SOP Description (sop_related).
 */
export function normalizeSopDescriptionKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Gabungkan hasil OpenAI ke item modal — satu komentar per SOP Description.
 */
export function mergeCommentsIntoItems(items, commentsArray) {
  if (!Array.isArray(items)) return [];
  const generated = Array.isArray(commentsArray) ? commentsArray : [];

  const byDescription = new Map();
  for (const c of generated) {
    const key = normalizeSopDescriptionKey(c.sop_related);
    const text = (c.comment || "").trim();
    if (key && text) byDescription.set(key, text);
  }

  return items.map((it, idx) => {
    const key = normalizeSopDescriptionKey(it.sop_related);
    const fromDescription = key ? byDescription.get(key) || "" : "";
    const fromIndex = (generated[idx]?.comment || "").trim();
    const existing = (it.comment || "").trim();
    const comment = fromDescription || fromIndex || existing;
    return { ...it, comment };
  });
}

/**
 * Terapkan komentar ke baris tabel SOP (match by sop_related, bukan nomor urut saja).
 */
export function applyCommentsToSopRows(rows, commentsArray) {
  if (!Array.isArray(rows)) return [];
  const generated = Array.isArray(commentsArray) ? commentsArray : [];

  const byDescription = new Map();
  for (const c of generated) {
    const key = normalizeSopDescriptionKey(c.sop_related);
    const text = (c.comment || "").trim();
    if (key && text) byDescription.set(key, text);
  }

  return rows.map((row) => {
    const key = normalizeSopDescriptionKey(row.sop_related);
    if (!key) return row;
    const comment = byDescription.get(key);
    if (!comment) return row;
    return { ...row, comment };
  });
}
