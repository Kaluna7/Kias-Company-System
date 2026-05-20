"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function EvidenceUploadProgressOverlay({
  open,
  progress = 0,
  currentFile = "",
  totalFiles = 0,
  completedFiles = 0,
}) {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/animation/loading.json")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-upload-progress-title"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 text-center">
        <h2 id="evidence-upload-progress-title" className="text-base font-semibold text-slate-900 mb-1">
          Uploading evidence
        </h2>
        <p className="text-xs text-slate-500 mb-4">Please wait until the upload finishes.</p>

        <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center">
          {animationData ? (
            <Lottie animationData={animationData} loop className="h-full w-full" />
          ) : (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#141D38]" />
          )}
        </div>

        {totalFiles > 1 && (
          <p className="text-xs text-slate-600 mb-2">
            File {Math.min(completedFiles + 1, totalFiles)} of {totalFiles}
          </p>
        )}

        {currentFile ? (
          <p className="text-xs text-slate-700 font-medium truncate mb-3 px-1" title={currentFile}>
            {currentFile}
          </p>
        ) : null}

        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#141D38] to-[#2D3A5A] transition-[width] duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm font-bold text-[#141D38] tabular-nums">{pct}%</p>
      </div>
    </div>
  );
}
