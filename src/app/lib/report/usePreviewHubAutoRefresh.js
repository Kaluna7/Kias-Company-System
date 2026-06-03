"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  REPORT_PREVIEW_HUB_CHANGED,
  REPORT_PREVIEW_ONLYOFFICE_SYNC,
  storageKeyForHubChanged,
} from "./reportPreviewSyncEvents";

/**
 * Poll + SSE: saat hubRevision naik, panggil onRefresh (regenerate HTML preview dari snapshot).
 * @param {number} year
 * @param {(snapshot: object) => void | Promise<void>} onRefresh
 */
export function usePreviewHubAutoRefresh(year, onRefresh) {
  const hubRevisionRef = useRef(0);
  const baselineSetRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const fetchSnapshotAndMaybeRefresh = useCallback(async () => {
    if (!Number.isFinite(year)) return;
    try {
      const res = await fetch(
        `/api/report/hub/snapshot?year=${encodeURIComponent(String(year))}&_=${Date.now()}`,
        { cache: "no-store", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!json.success) return;

      const rev = Number(json.hubRevision) || 0;

      if (!baselineSetRef.current) {
        hubRevisionRef.current = rev;
        baselineSetRef.current = true;
        return;
      }

      if (rev > hubRevisionRef.current) {
        hubRevisionRef.current = rev;
        await onRefreshRef.current?.(json);
      }
    } catch {
      /* ignore */
    }
  }, [year]);

  useEffect(() => {
    baselineSetRef.current = false;
    hubRevisionRef.current = 0;
    fetchSnapshotAndMaybeRefresh();
  }, [fetchSnapshotAndMaybeRefresh]);

  useEffect(() => {
    if (!Number.isFinite(year)) return undefined;

    let es = null;
    try {
      es = new EventSource(
        `/api/report/state-stream?year=${encodeURIComponent(String(year))}`,
      );
      es.onmessage = () => {
        fetchSnapshotAndMaybeRefresh();
      };
    } catch {
      /* SSE unsupported */
    }

    const onHubEvent = (e) => {
      if (e.detail?.year != null && Number(e.detail.year) !== year) return;
      fetchSnapshotAndMaybeRefresh();
    };
    const onStorage = (e) => {
      if (e.key !== storageKeyForHubChanged(year)) return;
      fetchSnapshotAndMaybeRefresh();
    };

    window.addEventListener(REPORT_PREVIEW_HUB_CHANGED, onHubEvent);
    window.addEventListener(REPORT_PREVIEW_ONLYOFFICE_SYNC, onHubEvent);
    window.addEventListener("storage", onStorage);

    const poll = window.setInterval(fetchSnapshotAndMaybeRefresh, 2000);

    return () => {
      es?.close();
      window.removeEventListener(REPORT_PREVIEW_HUB_CHANGED, onHubEvent);
      window.removeEventListener(REPORT_PREVIEW_ONLYOFFICE_SYNC, onHubEvent);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
    };
  }, [year, fetchSnapshotAndMaybeRefresh]);

  return {
    refreshHubSnapshot: fetchSnapshotAndMaybeRefresh,
    hubRevisionRef,
    forceRefreshHub: useCallback(async () => {
      baselineSetRef.current = true;
      const res = await fetch(
        `/api/report/hub/snapshot?year=${encodeURIComponent(String(year))}&_=${Date.now()}`,
        { cache: "no-store", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!json.success) return null;
      hubRevisionRef.current = Number(json.hubRevision) || 0;
      await onRefreshRef.current?.(json);
      return json;
    }, [year]),
  };
}
