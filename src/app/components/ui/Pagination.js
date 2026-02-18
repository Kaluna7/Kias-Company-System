"use client";

/**
 * Simple pagination bar. meta: { total, page, pageSize }
 */
export default function Pagination({ meta, onPageChange, loading = false, className = "" }) {
  if (!meta || meta.total <= 0) return null;
  const { total, page, pageSize } = meta;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 ${className}`}>
      <p className="text-xs text-gray-600">
        Menampilkan {from}–{to} dari {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sebelumnya
        </button>
        <span className="px-2 text-xs text-gray-600">
          Halaman {page} dari {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Selanjutnya
        </button>
      </div>
    </div>
  );
}
