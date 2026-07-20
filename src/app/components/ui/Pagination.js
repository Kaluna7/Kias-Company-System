"use client";

function scrollPageToTop() {
  if (typeof window === "undefined") return;

  const run = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
    try {
      document.documentElement?.scrollTo?.({ top: 0, behavior: "smooth" });
      document.body?.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch {
      /* ignore */
    }
  };

  // After React paints the new page content.
  requestAnimationFrame(() => {
    run();
    setTimeout(run, 80);
  });
}

/**
 * Pagination bar with Previous / page numbers / Next.0
 * meta: { total, page, pageSize }
 */
export default function Pagination({
  meta,
  onPageChange,
  loading = false,
  className = "",
  scrollToTopOnChange = true,
}) {
  if (!meta || meta.total <= 0) return null;

  const total = Number(meta.total) || 0;
  const page = Math.max(1, Number(meta.page) || 1);
  const pageSize = Math.max(1, Number(meta.pageSize) || 50);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageNumbers = [];
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  for (let i = start; i <= end; i++) pageNumbers.push(i);

  const goToPage = (nextPage) => {
    if (nextPage === page || loading) return;
    onPageChange(nextPage);
    if (scrollToTopOnChange) scrollPageToTop();
  };

  return (
    <div
      className={`flex flex-col items-center gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 ${className}`}
    >
      <p className="text-xs text-gray-600 text-center">
        Showing <span className="font-semibold text-gray-800">{from}</span>–
        <span className="font-semibold text-gray-800">{to}</span> of{" "}
        <span className="font-semibold text-gray-800">{total}</span>
        <span className="text-gray-400"> · </span>
        max {pageSize} per page
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => goToPage(page - 1)}
          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {start > 1 && (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={() => goToPage(1)}
              className="min-w-[2rem] px-2 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-xs text-gray-400">…</span>}
          </>
        )}

        {pageNumbers.map((n) => (
          <button
            key={n}
            type="button"
            disabled={loading || n === page}
            onClick={() => goToPage(n)}
            className={`min-w-[2rem] px-2 py-1.5 text-xs font-medium rounded border transition-colors ${
              n === page
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            } disabled:cursor-default`}
          >
            {n}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-xs text-gray-400">…</span>}
            <button
              type="button"
              disabled={loading}
              onClick={() => goToPage(totalPages)}
              className="min-w-[2rem] px-2 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => goToPage(page + 1)}
          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
