/**
 * Panggil API OpenAI generate-comments-preview untuk daftar langkah SOP.
 * @param {string} apiPath
 * @param {Array<{ id?: number|null, sop_related: string }>} items
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
