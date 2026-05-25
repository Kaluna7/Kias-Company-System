/**
 * Gabungkan hasil OpenAI generate-comments ke item modal / append.
 * Prioritas: urutan index (sama dengan request), lalu cocokkan teks sop_related.
 */
export function mergeCommentsIntoItems(items, commentsArray) {
  if (!Array.isArray(items)) return [];
  const generated = Array.isArray(commentsArray) ? commentsArray : [];

  const byText = new Map();
  for (const c of generated) {
    const key = (c.sop_related || "").trim().toLowerCase();
    if (!key) continue;
    const text = (c.comment || "").trim();
    if (text) byText.set(key, text);
  }

  return items.map((it, idx) => {
    const key = (it.sop_related || "").trim().toLowerCase();
    const fromIndex = (generated[idx]?.comment || "").trim();
    const fromKey = byText.get(key) || "";
    const existing = (it.comment || "").trim();
    const comment = fromIndex || fromKey || existing;
    return { ...it, comment };
  });
}
