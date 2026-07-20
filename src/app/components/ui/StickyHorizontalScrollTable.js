"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Split header/body table with synced horizontal scroll, bottom scrollbar, and touchpad wheel support.
 */
export default function StickyHorizontalScrollTable({
  header,
  children,
  colGroup = null,
  tableClassName = "min-w-[1000px] w-full border-collapse text-xs sm:text-sm text-gray-700",
  tableStyle,
  className = "",
  measureDeps = [],
  internalVerticalScroll = true,
  bodyMinHeight = null,
  stickyHeader = false,
  stickyHeaderTopClass = "top-0",
  stickyHeaderClassName = "bg-gray-100 border-b border-gray-200",
}) {
  const hasMinBodyHeight = Boolean(bodyMinHeight);
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const headerScrollRef = useRef(null);
  const xScrollRef = useRef(null);
  const hBarRef = useRef(null);
  const tableRef = useRef(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1000);
  const [needsHorizontalScroll, setNeedsHorizontalScroll] = useState(false);
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

  const updateScrollMetrics = useCallback(() => {
    const table = tableRef.current;
    const scroller = xScrollRef.current;
    if (!table) return;

    const width = table.scrollWidth;
    setTableScrollWidth(width);

    if (scroller) {
      setNeedsHorizontalScroll(width > scroller.clientWidth + 1);
    }
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

    updateScrollMetrics();

    const ro = new ResizeObserver(updateScrollMetrics);
    ro.observe(table);
    if (xScrollRef.current) ro.observe(xScrollRef.current);
    window.addEventListener("resize", updateScrollMetrics);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScrollMetrics);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, measureDeps);

  const hideNativeHorizontalScrollbar =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

  // Page-scroll mode: sticky header must not live on an overflow-x element (breaks sticky).
  const headerScroller = (
    <div
      ref={headerScrollRef}
      className={`overflow-x-auto overflow-y-hidden ${stickyHeaderClassName} ${hideNativeHorizontalScrollbar}`}
      onScroll={() => syncHorizontalScroll("header")}
    >
      <table className={tableClassName} style={tableStyle}>
        {colGroup}
        {header}
      </table>
    </div>
  );

  return (
    <div
      className={`relative flex w-full flex-col ${
        internalVerticalScroll ? "min-h-0 flex-1" : "h-auto"
      } ${className}`}
    >
      <div className="mb-2 px-1 md:hidden">
        <div className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
          Geser tabel ke samping untuk melihat semua kolom.
        </div>
      </div>
      <div
        ref={panelRef}
        className={`flex flex-col ${
          internalVerticalScroll
            ? "min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            : "h-auto overflow-visible bg-white"
        }`}
      >
        {stickyHeader && !internalVerticalScroll ? (
          <div
            className={`sticky z-20 shrink-0 ${stickyHeaderClassName} ${stickyHeaderTopClass} shadow-[0_2px_8px_rgba(15,23,42,0.12)]`}
          >
            {headerScroller}
          </div>
        ) : (
          <div
            className={`shrink-0 ${
              stickyHeader
                ? `sticky z-20 ${stickyHeaderClassName} ${stickyHeaderTopClass} shadow-[0_2px_8px_rgba(15,23,42,0.12)]`
                : ""
            }`}
          >
            {headerScroller}
          </div>
        )}

        <div
          ref={bodyRef}
          className={
            internalVerticalScroll
              ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white"
              : hasMinBodyHeight
                ? "overflow-x-hidden overflow-y-visible bg-white"
                : "h-auto overflow-x-hidden overflow-y-visible bg-white"
          }
          style={hasMinBodyHeight ? { minHeight: bodyMinHeight } : undefined}
        >
          <div
            ref={xScrollRef}
            className={`min-h-full overflow-x-auto overflow-y-visible ${hideNativeHorizontalScrollbar}`}
            onScroll={() => syncHorizontalScroll("content")}
          >
            <table ref={tableRef} className={tableClassName} style={tableStyle}>
              {colGroup}
              {children}
            </table>
          </div>
        </div>

        {needsHorizontalScroll && (
          <div
            ref={hBarRef}
            className={`shrink-0 overflow-x-auto overflow-y-hidden border-t border-gray-200 bg-gray-50 ${
              internalVerticalScroll
                ? "sticky bottom-0 z-10 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
                : "sticky bottom-0 z-10"
            }`}
            onScroll={() => syncHorizontalScroll("bar")}
            aria-label="Scroll table horizontally"
          >
            <div style={{ width: tableScrollWidth, height: 14 }} />
          </div>
        )}
      </div>
    </div>
  );
}
