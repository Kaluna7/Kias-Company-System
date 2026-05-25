import { mergeCommentsIntoItems } from "@/app/utils/mergeSopReviewComments";

/**
 * Panggil API OpenAI generate-comments-preview untuk daftar langkah SOP.
 */
export async function fetchSopReviewCommentsPreview(apiPath, items) {
  try {
    const res = await fetch(
      `/api/SopReview/${encodeURIComponent(apiPath)}/generate-comments-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: (items || []).map((it) => ({
            id: it.id ?? null,
            sop_related: it.sop_related || "",
          })),
        }),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: json?.error || `API error (${res.status})`,
        comments: [],
      };
    }
    return json;
  } catch (err) {
    return { success: false, error: String(err), comments: [] };
  }
}

/**
 * Generate & merge review comment untuk setiap SOP Description (satu API call per batch item list).
 * @param {string} apiPath
 * @param {Array<{ no?: number, sop_related: string, comment?: string }>} items
 */
export async function fillReviewCommentsForItems(apiPath, items) {
  const base = (items || []).map((it, idx) => ({
    no: it.no ?? idx + 1,
    sop_related: (it.sop_related || "").trim(),
    comment: (it.comment || "").trim(),
  }));

  const needApi = base.some((it) => it.sop_related && !(it.comment || "").trim());
  if (!needApi) {
    return { success: true, items: base, error: null };
  }

  const res = await fetchSopReviewCommentsPreview(
    apiPath,
    base.map((it) => ({ id: it.id ?? null, sop_related: it.sop_related })),
  );

  if (!res?.success || !Array.isArray(res.comments)) {
    return {
      success: false,
      items: base,
      error: res?.error || "OpenAI gagal membuat komentar",
    };
  }

  return {
    success: true,
    items: mergeCommentsIntoItems(base, res.comments),
    error: null,
  };
}
