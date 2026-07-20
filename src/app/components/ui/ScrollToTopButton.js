"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Floating button (bottom-right) that appears after scrolling down and scrolls back to top.
 */
export default function ScrollToTopButton({
  threshold = 280,
  className = "",
  label = "Back to top",
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm transition-all hover:bg-slate-50 hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6 sm:text-sm ${className}`}
      title={label}
      aria-label={label}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
      Top
    </button>
  );
}
