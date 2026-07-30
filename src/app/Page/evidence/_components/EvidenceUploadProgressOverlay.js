"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Lottie from "lottie-react";

const LOADING_JSON_URL = "/animation/loading.json";

/**
 * @param {"uploading"|"success"|"error"} phase
 * @param {"upload"|"download"} mode
 */
export default function EvidenceUploadProgressOverlay({
  open,
  phase = "uploading",
  progress = 0,
  currentFile = "",
  totalFiles = 0,
  completedFiles = 0,
  errorMessage = "",
  mode = "upload",
  onCancel,
  onClose,
}) {
  const [mounted, setMounted] = useState(false);
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(LOADING_JSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  const isBusy = phase === "uploading";
  const isSuccess = phase === "success";
  const isError = phase === "error";
  const isDownload = mode === "download";
  const isStorageDown =
    isError &&
    !isDownload &&
    /minio|storage.*mati|tidak tersimpan/i.test(String(errorMessage || ""));

  const title = isError
    ? isDownload
      ? "Download gagal"
      : isStorageDown
        ? "Storage MinIO bermasalah"
        : "Upload gagal"
    : isSuccess
      ? isDownload
        ? "Download selesai"
        : "Upload selesai"
      : isDownload
        ? "Mengunduh evidence"
        : "Mengunggah evidence";

  const subtitle = isError
    ? isDownload
      ? "File tidak terunduh. Periksa pesan di bawah lalu coba lagi."
      : isStorageDown
        ? "File TIDAK tersimpan di server. Nyalakan MinIO dulu, lalu upload ulang."
        : "File tidak tersimpan. Periksa pesan di bawah lalu coba lagi."
    : isSuccess
      ? isDownload
        ? "File siap di perangkat Anda."
        : "File berhasil diunggah."
      : isDownload
        ? "Mohon tunggu — file sedang diambil dari storage."
        : "Jangan tutup halaman hingga proses selesai.";

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-upload-progress-title"
      aria-busy={isBusy}
      onClick={isError && onClose ? (e) => e.target === e.currentTarget && onClose() : undefined}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 text-center">
        <h2 id="evidence-upload-progress-title" className="text-base font-semibold text-slate-900 mb-1">
          {title}
        </h2>
        <p className="text-xs text-slate-500 mb-4">{subtitle}</p>

        {isBusy && (
          <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center">
            {animationData ? (
              <Lottie animationData={animationData} loop autoplay className="h-full w-full" />
            ) : (
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#141D38]" />
            )}
          </div>
        )}

        {isSuccess && (
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {isError && (
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}

        {totalFiles > 1 && isBusy && !isDownload && (
          <p className="text-xs text-slate-600 mb-2">
            File {Math.min(completedFiles + 1, totalFiles)} dari {totalFiles}
          </p>
        )}

        {currentFile ? (
          <p className="text-xs text-slate-700 font-medium truncate mb-3 px-1" title={currentFile}>
            {currentFile}
          </p>
        ) : null}

        {isError && errorMessage ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-left whitespace-pre-wrap break-words">
            {errorMessage}
          </p>
        ) : null}

        {isBusy && (
          <>
            <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#141D38] to-[#2D3A5A] transition-[width] duration-150 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-sm font-bold text-[#141D38] tabular-nums">
              {pct > 0 ? `${pct}%` : isDownload ? "Menyiapkan…" : "0%"}
            </p>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </>
        )}

        {isSuccess && <p className="text-lg font-bold text-emerald-700 tabular-nums">100%</p>}

        {isError && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-lg bg-[#141D38] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1f2a4a] transition-colors"
          >
            Tutup
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
