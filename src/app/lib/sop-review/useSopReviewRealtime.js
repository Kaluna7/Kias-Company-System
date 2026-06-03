"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  SOP_REVIEW_DATA_CHANGED_KEY,
  SOP_REVIEW_DATA_BROADCAST_CHANNEL,
} from "./sopReviewNotifyClient";

/**
 * Reload HTML preview when SOP Review publish/edit changes published data.
 * @param {number} year Report preview year (?year=)
 * @param {() => void} onDataChanged
 */
export function useSopReviewRealtime(year, onDataChanged) {
  const onChangeRef = useRef(onDataChanged);
  onChangeRef.current = onDataChanged;

  const handleEvent = useCallback(
    (detail) => {
      if (!Number.isFinite(year)) return;
      const eventYear =
        detail?.reportYear != null
          ? Number(detail.reportYear)
          : detail?.year != null
            ? Number(detail.year)
            : null;
      if (eventYear != null && Number.isFinite(eventYear) && eventYear !== year) return;
      onChangeRef.current?.(detail);
    },
    [year],
  );

  useEffect(() => {
    if (!Number.isFinite(year)) return undefined;

    let es = null;
    try {
      es = new EventSource(
        `/api/sop-review/data-stream?year=${encodeURIComponent(String(year))}`,
      );
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "connected") return;
          handleEvent(data);
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* ignore */
    }

    const onCustom = (e) => handleEvent(e.detail || {});
    const onStorage = (e) => {
      if (e.key !== SOP_REVIEW_DATA_CHANGED_KEY) return;
      try {
        handleEvent(JSON.parse(e.newValue || "{}"));
      } catch {
        handleEvent({});
      }
    };

    let bc = null;
    try {
      bc = new BroadcastChannel(SOP_REVIEW_DATA_BROADCAST_CHANNEL);
      bc.onmessage = (ev) => handleEvent(ev.data || {});
    } catch {
      /* ignore */
    }

    window.addEventListener(SOP_REVIEW_DATA_CHANGED_KEY, onCustom);
    window.addEventListener("storage", onStorage);

    return () => {
      es?.close();
      bc?.close();
      window.removeEventListener(SOP_REVIEW_DATA_CHANGED_KEY, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [year, handleEvent]);
}
