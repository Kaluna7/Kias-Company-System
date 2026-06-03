"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyPublishStateToFindingSections } from "@/app/lib/report/applyPublishStateToFindingSections";
import {
  AUDIT_REVIEW_PUBLISH_CHANGED_KEY,
  AUDIT_PUBLISH_BROADCAST_CHANNEL,
} from "@/app/lib/audit-review/reportPublishLockClient";

const BROADCAST_CHANNEL = AUDIT_PUBLISH_BROADCAST_CHANNEL;

/**
 * Realtime lock/unlock sync for report preview (SSE + BroadcastChannel + batch API).
 * @param {number} year
 */
export function useReportAuditPublishRealtime(year) {
  const [publishStatusByDept, setPublishStatusByDept] = useState({});
  const [streamConnected, setStreamConnected] = useState(false);
  const publishRef = useRef({});

  const fetchBatchStatus = useCallback(async () => {
    if (!Number.isFinite(year)) return {};
    try {
      const res = await fetch(
        `/api/audit-review/publish-status/batch?year=${encodeURIComponent(String(year))}`,
        { cache: "no-store", credentials: "include" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.byDept) return publishRef.current;
      const map = {};
      for (const [deptKey, st] of Object.entries(json.byDept)) {
        map[deptKey] = st.isLocked === true;
      }
      publishRef.current = map;
      setPublishStatusByDept(map);
      return map;
    } catch {
      return publishRef.current;
    }
  }, [year]);

  useEffect(() => {
    fetchBatchStatus();
  }, [fetchBatchStatus]);

  /** Backup sync if SSE/tab events are missed (e.g. multi-tab or proxy buffering). */
  useEffect(() => {
    if (!Number.isFinite(year)) return undefined;
    const id = setInterval(() => {
      fetchBatchStatus();
    }, 10000);
    return () => clearInterval(id);
  }, [year, fetchBatchStatus]);

  useEffect(() => {
    if (!Number.isFinite(year)) return undefined;

    let es = null;
    try {
      es = new EventSource(
        `/api/audit-review/publish-stream?year=${encodeURIComponent(String(year))}`,
      );
      es.onopen = () => setStreamConnected(true);
      es.onerror = () => setStreamConnected(false);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "connected") return;
          if (!data.deptKey) return;

          const sameReportYear =
            !Number.isFinite(data.year) || !Number.isFinite(year) || data.year === year;

          if (sameReportYear) {
            setPublishStatusByDept((prev) => {
              const next = { ...prev, [data.deptKey]: data.isLocked === true };
              publishRef.current = next;
              return next;
            });
          }

          // Always re-sync from DB (year-scoped) so unlock in Audit Review matches report ?year=
          fetchBatchStatus();
        } catch {
          /* ignore */
        }
      };
    } catch {
      setStreamConnected(false);
    }

    let bc = null;
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL);
      bc.onmessage = (ev) => {
        const data = ev.data || {};
        if (!data.deptKey) return;
        const sameReportYear =
          !Number.isFinite(data.year) || !Number.isFinite(year) || data.year === year;
        if (sameReportYear) {
          setPublishStatusByDept((prev) => {
            const next = { ...prev, [data.deptKey]: data.isLocked === true };
            publishRef.current = next;
            return next;
          });
        }
        fetchBatchStatus();
      };
    } catch {
      /* BroadcastChannel unsupported */
    }

    const onPublishChanged = () => {
      fetchBatchStatus();
    };
    window.addEventListener(AUDIT_REVIEW_PUBLISH_CHANGED_KEY, onPublishChanged);

    return () => {
      es?.close();
      bc?.close();
      window.removeEventListener(AUDIT_REVIEW_PUBLISH_CHANGED_KEY, onPublishChanged);
      setStreamConnected(false);
    };
  }, [year, fetchBatchStatus]);

  /** Apply current publish map to finding sections immediately (no API reload). */
  const applyPublishToFindingSections = useCallback((sections) => {
    return applyPublishStateToFindingSections(sections, publishRef.current);
  }, []);

  return {
    publishStatusByDept,
    publishStatusRef: publishRef,
    streamConnected,
    refreshPublishStatus: fetchBatchStatus,
    applyPublishToFindingSections,
  };
}
