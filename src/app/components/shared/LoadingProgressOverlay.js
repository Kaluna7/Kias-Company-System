"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Lottie from "lottie-react";

const LOADING_JSON_URL = "/animation/loading.json";

let cachedAnimation = null;
let preloadPromise = null;

/** Muat animasi sekali agar overlay tidak menunggu fetch saat upload PDF. */
export function preloadLoadingAnimation() {
  if (cachedAnimation) return Promise.resolve(cachedAnimation);
  if (!preloadPromise) {
    preloadPromise = fetch(LOADING_JSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        cachedAnimation = data;
        return data;
      })
      .catch(() => null);
  }
  return preloadPromise;
}

if (typeof window !== "undefined") {
  preloadLoadingAnimation();
}

/**
 * Full-screen loading overlay with Lottie animation and percent progress bar.
 */
export default function LoadingProgressOverlay({
  open = false,
  progress = 0,
  title = "Loading...",
  subtitle = "Please do not close this page until the process completes.",
  statusLabel = "",
  fileName = "",
}) {
  const [mounted, setMounted] = useState(false);
  const [animationData, setAnimationData] = useState(cachedAnimation);

  useEffect(() => {
    setMounted(true);
    preloadLoadingAnimation().then((data) => {
      if (data) setAnimationData(data);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    if (cachedAnimation) {
      setAnimationData(cachedAnimation);
      return;
    }
    let cancelled = false;
    preloadLoadingAnimation().then((data) => {
      if (!cancelled && data) setAnimationData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  const displayPct = pct > 0 ? pct : 1;

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-progress-title"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 text-center">
        <h2 id="loading-progress-title" className="text-base font-semibold text-slate-900 mb-1">
          {title}
        </h2>
        {subtitle ? <p className="text-xs text-slate-500 mb-4">{subtitle}</p> : <div className="mb-4" />}

        <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center">
          {animationData ? (
            <Lottie animationData={animationData} loop autoplay className="h-full w-full" />
          ) : (
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#141D38]" />
          )}
        </div>

        {statusLabel ? (
          <p className="text-xs text-slate-600 mb-3 px-1">{statusLabel}</p>
        ) : null}

        {fileName ? (
          <p className="text-xs text-slate-700 font-medium truncate mb-3 px-1" title={fileName}>
            {fileName}
          </p>
        ) : null}

        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#141D38] to-[#2D3A5A] transition-[width] duration-150 ease-out"
            style={{ width: `${displayPct}%` }}
          />
        </div>
        <p className="text-sm font-bold text-[#141D38] tabular-nums">{displayPct}%</p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
