"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Split header/body table with synced horizontal scroll, bottom scrollbar, and touchpad wheel support.
 */
export default function StickyHorizontalScrollTable({
  header,
  children,
  tableClassName = "min-w-[1000px] w-full border-collapse text-xs sm:text-sm text-gray-700",
  tableStyle,
  className = "",
  measureDeps = [],
}) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const headerScrollRef = useRef(null);
  const xScrollRef = useRef(null);
  const hBarRef = useRef(null);
  const tableRef = useRef(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1000);
  const scrollSyncLock = useRef(false);

  const syncHorizontalScroll = useCallback((source) => {
    if (scrollSyncLock.current) return;
    scrollSyncLock.current = true;
    const left =
      source === "bar"
        ? (hBarRef.current?.scrollLeft ?? 0)
        : source === "header"
          ? (headerScrollRef.current?.scrollLeft ?? 0)
          : (xScrollRef.current?.scrollLeft ?? 0);
    if (xScrollRef.current) xScrollRef.current.scrollLeft = left;
    if (hBarRef.current) hBarRef.current.scrollLeft = left;
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = left;
    requestAnimationFrame(() => {
      scrollSyncLock.current = false;
    });
  }, []);

  const handleWheel = useCallback(
    (e) => {
      const scroller = xScrollRef.current;
      if (!scroller) return;

      const { deltaX, deltaY } = e;
      const delta = e.shiftKey ? deltaY : deltaX;
      const isHorizontalGesture =
        e.shiftKey || (Math.abs(deltaX) > 0 && Math.abs(deltaX) >= Math.abs(deltaY));
      if (!isHorizontalGesture || delta === 0) return;

      const maxLeft = scroller.scrollWidth - scroller.clientWidth;
      if (maxLeft <= 0) return;

      const next = Math.min(maxLeft, Math.max(0, scroller.scrollLeft + delta));
      if (next === scroller.scrollLeft) return;

      scroller.scrollLeft = next;
      syncHorizontalScroll("content");
      e.preventDefault();
    },
    [syncHorizontalScroll],
  );

  useEffect(() => {
    const root = panelRef.current;
    if (!root) return;
    root.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => root.removeEventListener("wheel", handleWheel, { capture: true });
  }, [handleWheel]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const updateWidth = () => setTableScrollWidth(table.scrollWidth);
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(table);
    window.addEventListener("resize", updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, measureDeps);

  return (
    <div className={`relative flex min-h-0 w-full flex-1 flex-col ${className}`}>
      <div className="mb-2 px-1 md:hidden">
        <div className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
          Geser tabel ke samping untuk melihat semua kolom.
        </div>
      </div>
      <div
        ref={panelRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <div
          ref={headerScrollRef}
          className="shrink-0 overflow-x-auto overflow-y-hidden border-b border-gray-200 bg-gray-50 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onScroll={() => syncHorizontalScroll("header")}
        >
          <table className={tableClassName} style={tableStyle}>
            {header}
          </table>
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div
            ref={xScrollRef}
            className="overflow-x-auto overflow-y-visible"
            onScroll={() => syncHorizontalScroll("content")}
          >
            <table ref={tableRef} className={tableClassName} style={tableStyle}>
              {children}
            </table>
          </div>
        </div>

        <div
          ref={hBarRef}
          className="shrink-0 overflow-x-auto overflow-y-hidden border-t border-gray-200 bg-gray-50"
          onScroll={() => syncHorizontalScroll("bar")}
          aria-label="Scroll table horizontally"
        >
          <div style={{ width: tableScrollWidth, height: 14 }} />
        </div>
      </div>
    </div>
  );
}
