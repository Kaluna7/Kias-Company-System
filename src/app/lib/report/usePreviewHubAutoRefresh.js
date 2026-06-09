"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  REPORT_PREVIEW_HUB_CHANGED,
  REPORT_PREVIEW_ONLYOFFICE_SYNC,
  storageKeyForHubChanged,
} from "./reportPreviewSyncEvents";
import { subscribePreviewWebSocket } from "./previewWebSocketClient";

const REPORT_STATE_EVENT = "report-state-changed";

/**
 * WebSocket + same-tab events: saat hubRevision naik, panggil onRefresh.
 * @param {number} year
 * @param {(snapshot: object) => void | Promise<void>} onRefresh
 */
export function usePreviewHubAutoRefresh(year, onRefresh) {
  const hubRevisionRef = useRef(0);
  const baselineSetRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  const fetchDebounceRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const acknowledgeHubRevision = useCallback((rev) => {
    const n = Number(rev) || 0;
    if (n <= 0) return;
    hubRevisionRef.current = n;
    baselineSetRef.current = true;
  }, []);

  const fetchSnapshotAndMaybeRefresh = useCallback(async () => {
    if (!Number.isFinite(year) || fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/report/hub/snapshot?year=${encodeURIComponent(String(year))}&_=${Date.now()}`,
        { cache: "no-store", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!json.success) return;

      const rev = Number(json.hubRevision) || 0;

      if (!baselineSetRef.current) {
        acknowledgeHubRevision(rev);
        return;
      }

      if (rev > hubRevisionRef.current) {
        acknowledgeHubRevision(rev);
        await onRefreshRef.current?.(json);
      }
    } catch {
      /* ignore */
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [year, acknowledgeHubRevision]);

  const scheduleSnapshotCheck = useCallback(() => {
    if (fetchDebounceRef.current) {
      window.clearTimeout(fetchDebounceRef.current);
    }
    fetchDebounceRef.current = window.setTimeout(() => {
      fetchDebounceRef.current = null;
      void fetchSnapshotAndMaybeRefresh();
    }, 500);
  }, [fetchSnapshotAndMaybeRefresh]);

  useEffect(() => {
    baselineSetRef.current = false;
    hubRevisionRef.current = 0;
    fetchSnapshotAndMaybeRefresh();
  }, [fetchSnapshotAndMaybeRefresh]);

  useEffect(() => {
    if (!Number.isFinite(year)) return undefined;

    const unsubWs = subscribePreviewWebSocket(year, (data) => {
      if (data.type !== REPORT_STATE_EVENT) return;
      if (data.year != null && Number(data.year) !== year) return;
      scheduleSnapshotCheck();
    });

    const onHubEvent = (e) => {
      if (e.detail?.year != null && Number(e.detail.year) !== year) return;
      scheduleSnapshotCheck();
    };
    const onStorage = (e) => {
      if (e.key !== storageKeyForHubChanged(year)) return;
      scheduleSnapshotCheck();
    };

    window.addEventListener(REPORT_PREVIEW_HUB_CHANGED, onHubEvent);
    window.addEventListener(REPORT_PREVIEW_ONLYOFFICE_SYNC, onHubEvent);
    window.addEventListener("storage", onStorage);

    return () => {
      unsubWs();
      window.removeEventListener(REPORT_PREVIEW_HUB_CHANGED, onHubEvent);
      window.removeEventListener(REPORT_PREVIEW_ONLYOFFICE_SYNC, onHubEvent);
      window.removeEventListener("storage", onStorage);
      if (fetchDebounceRef.current) {
        window.clearTimeout(fetchDebounceRef.current);
        fetchDebounceRef.current = null;
      }
    };
  }, [year, scheduleSnapshotCheck]);

  return {
    refreshHubSnapshot: fetchSnapshotAndMaybeRefresh,
    hubRevisionRef,
    acknowledgeHubRevision,
    forceRefreshHub: useCallback(async () => {
      const res = await fetch(
        `/api/report/hub/snapshot?year=${encodeURIComponent(String(year))}&_=${Date.now()}`,
        { cache: "no-store", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!json.success) return null;
      acknowledgeHubRevision(Number(json.hubRevision) || 0);
      await onRefreshRef.current?.(json);
      return json;
    }, [year, acknowledgeHubRevision]),
  };
}
