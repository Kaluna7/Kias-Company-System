/** True when HTML has visible text (not only tags, nbsp, or whitespace). */
export function htmlPageHasVisibleContent(html) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}

export function filterMeaningfulHtmlPages(pages) {
  return (pages || [])
    .map((p) => String(p ?? "").trim())
    .filter((html) => htmlPageHasVisibleContent(html));
}

export function resolveHtmlPageList(pagesHtml, fallbackHtml) {
  const fromPages = filterMeaningfulHtmlPages(pagesHtml);
  if (fromPages.length > 0) return fromPages;
  const fb = String(fallbackHtml ?? "").trim();
  return htmlPageHasVisibleContent(fb) ? [fb] : [];
}
