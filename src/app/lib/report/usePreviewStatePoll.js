"use client";

import { useEffect, useRef } from "react";
import { pickPreviewWsSyncState } from "./pickPreviewWsSyncState";

const POLL_MS = 2000;

/**
 * HTTP fallback: poll report state when previewSyncRevision changes (works without WS).
 * @param {number} year
 * @param {(state: object, meta: object) => void} onState
 * @param {{ enabled?: boolean, initialRevision?: number }} [options]
 */
export function usePreviewStatePoll(year, onState, options = {}) {
  const enabled = options.enabled !== false;
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const lastRevisionRef = useRef(Number(options.initialRevision) || 0);

  useEffect(() => {
    lastRevisionRef.current = Number(options.initialRevision) || 0;
  }, [year, options.initialRevision]);

  useEffect(() => {
    if (!enabled || !Number.isFinite(year)) return undefined;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/report/state?year=${encodeURIComponent(String(year))}`,
          { credentials: "include", cache: "no-store" },
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled || !json.success || !json.state) return;

        const rev = Number(json.state.previewSyncRevision) || 0;
        if (rev <= 0) return;
        if (lastRevisionRef.current === 0) {
          lastRevisionRef.current = rev;
          return;
        }
        if (rev <= lastRevisionRef.current) return;

        lastRevisionRef.current = rev;
        const syncState = pickPreviewWsSyncState(json.state);
        onStateRef.current?.(syncState, {
          senderClientId: "server",
          previewSyncRevision: rev,
        });
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [year, enabled]);
}
