"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyPublishStateToFindingSections } from "@/app/lib/report/applyPublishStateToFindingSections";
import {
  AUDIT_REVIEW_PUBLISH_CHANGED_KEY,
  AUDIT_PUBLISH_BROADCAST_CHANNEL,
} from "@/app/lib/audit-review/reportPublishLockClient";
import {
  subscribePreviewWebSocket,
  subscribePreviewWebSocketStatus,
} from "@/app/lib/report/previewWebSocketClient";

const BROADCAST_CHANNEL = AUDIT_PUBLISH_BROADCAST_CHANNEL;
const PUBLISH_EVENT = "audit-review-publish";
const OPTIMISTIC_MS = 8000;

/**
 * Realtime lock/unlock sync for report preview (WebSocket + BroadcastChannel).
 * @param {number} year
 */
export function useReportAuditPublishRealtime(year) {
  const [publishStatusByDept, setPublishStatusByDept] = useState({});
  const [streamConnected, setStreamConnected] = useState(false);
  const publishRef = useRef({});
  /** deptKey → timestamp (ms) — jangan timpa event lock/unlock dengan batch API stale */
  const optimisticUntilRef = useRef({});

  const applyPublishEvent = useCallback((detail = {}) => {
    if (!detail.deptKey) return;
    const locked = detail.isLocked === true;
    setPublishStatusByDept((prev) => {
      const next = { ...prev, [detail.deptKey]: locked };
      publishRef.current = next;
      return next;
    });
    optimisticUntilRef.current[detail.deptKey] = Date.now() + OPTIMISTIC_MS;
  }, []);

  const fetchBatchStatus = useCallback(
    async (options = {}) => {
      if (!Number.isFinite(year)) return {};
      try {
        const res = await fetch(
          `/api/audit-review/publish-status/batch?year=${encodeURIComponent(String(year))}`,
          { cache: "no-store", credentials: "include" },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || !json.byDept) return publishRef.current;
        const now = Date.now();
        const map = { ...publishRef.current };
        for (const [deptKey, st] of Object.entries(json.byDept)) {
          if (!options.force && (optimisticUntilRef.current[deptKey] || 0) > now) {
            continue;
          }
          map[deptKey] = st.isLocked === true;
        }
        publishRef.current = map;
        setPublishStatusByDept(map);
        return map;
      } catch {
        return publishRef.current;
      }
    },
    [year],
  );

  useEffect(() => {
    fetchBatchStatus({ force: true });
  }, [fetchBatchStatus]);

  useEffect(() => {
    if (!Number.isFinite(year)) return undefined;

    const unsubWs = subscribePreviewWebSocket(year, (data) => {
      if (data.type !== PUBLISH_EVENT) return;
      if (!data.deptKey) return;

      const sameReportYear =
        !Number.isFinite(data.year) || !Number.isFinite(year) || data.year === year;

      if (sameReportYear) {
        applyPublishEvent(data);
      }
    });

    const unsubStatus = subscribePreviewWebSocketStatus(year, (status) => {
      setStreamConnected(status === "connected");
    });

    let bc = null;
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL);
      bc.onmessage = (ev) => {
        const data = ev.data || {};
        if (!data.deptKey) return;
        const sameReportYear =
          !Number.isFinite(data.year) || !Number.isFinite(year) || data.year === year;
        if (sameReportYear) {
          applyPublishEvent(data);
        }
      };
    } catch {
      /* BroadcastChannel unsupported */
    }

    const onPublishChanged = (e) => {
      applyPublishEvent(e.detail || {});
    };
    window.addEventListener(AUDIT_REVIEW_PUBLISH_CHANGED_KEY, onPublishChanged);

    return () => {
      unsubWs();
      unsubStatus();
      bc?.close();
      window.removeEventListener(AUDIT_REVIEW_PUBLISH_CHANGED_KEY, onPublishChanged);
      setStreamConnected(false);
    };
  }, [year, applyPublishEvent]);

  /** Apply current publish map to finding sections immediately (no API reload). */
  const applyPublishToFindingSections = useCallback((sections) => {
    return applyPublishStateToFindingSections(sections, publishRef.current);
  }, []);

  /** Sinkronkan status lock dari module API (hub snapshot) — mengalahkan batch API stale. */
  const syncPublishFromLockedByDept = useCallback((lockedByDept = {}) => {
    if (!lockedByDept || typeof lockedByDept !== "object") return;
    setPublishStatusByDept((prev) => {
      const next = { ...prev, ...lockedByDept };
      publishRef.current = next;
      return next;
    });
  }, []);

  return {
    publishStatusByDept,
    publishStatusRef: publishRef,
    streamConnected,
    refreshPublishStatus: fetchBatchStatus,
    applyPublishEvent,
    applyPublishToFindingSections,
    syncPublishFromLockedByDept,
  };
}
