"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  REPORT_PREVIEW_ONLYOFFICE_SYNC,
  notifyPreviewOnlyOfficeSync,
  storageKeyForOnlyOfficeSync,
} from "./reportPreviewSyncEvents";

/**
 * Realtime hub reload: OnlyOffice narrative lane + module-tables lane (SSE + poll).
 * @param {number} year
 * @param {(state: object, revision: number) => void} onNarrativeChanged — OnlyOffice / narasi DB
 * @param {(state: object, revision: number) => void} [onModuleTablesChanged] — tabel modul di hub
 */
export function useReportStateRealtime(year, onNarrativeChanged, onModuleTablesChanged) {
  const narrativeRevisionRef = useRef(0);
  const moduleTablesRevisionRef = useRef(0);
  const baselineSetRef = useRef(false);
  const onNarrativeRef = useRef(onNarrativeChanged);
  const onModulesRef = useRef(onModuleTablesChanged);
  onNarrativeRef.current = onNarrativeChanged;
  onModulesRef.current = onModuleTablesChanged;

  const fetchAndApply = useCallback(async () => {
    if (!Number.isFinite(year)) return;
    try {
      const res = await fetch(`/api/report/state?year=${encodeURIComponent(String(year))}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!json.success || !json.state) return;

      const state = json.state;
      const oRev = Number(state.onlyOfficeSyncRevision) || 0;
      const mRev = Number(state.moduleTablesRevision) || 0;

      if (!baselineSetRef.current) {
        narrativeRevisionRef.current = oRev;
        moduleTablesRevisionRef.current = mRev;
        baselineSetRef.current = true;
        return;
      }

      if (oRev > narrativeRevisionRef.current) {
        narrativeRevisionRef.current = oRev;
        onNarrativeRef.current?.(state, oRev);
        notifyPreviewOnlyOfficeSync(year, oRev);
      }

      if (mRev > moduleTablesRevisionRef.current) {
        moduleTablesRevisionRef.current = mRev;
        onModulesRef.current?.(state, mRev);
      }
    } catch {
      /* ignore */
    }
  }, [year]);

  useEffect(() => {
    baselineSetRef.current = false;
    narrativeRevisionRef.current = 0;
    moduleTablesRevisionRef.current = 0;
    fetchAndApply();
  }, [fetchAndApply]);

  useEffect(() => {
    if (!Number.isFinite(year)) return undefined;

    let es = null;
    try {
      es = new EventSource(
        `/api/report/state-stream?year=${encodeURIComponent(String(year))}`,
      );
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "connected") return;
          if (data.year != null && Number(data.year) !== year) return;
          fetchAndApply();
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* SSE unsupported */
    }

    const onCustom = (e) => {
      if (e.detail?.year != null && Number(e.detail.year) !== year) return;
      fetchAndApply();
    };
    const onStorage = (e) => {
      if (e.key !== storageKeyForOnlyOfficeSync(year)) return;
      fetchAndApply();
    };

    window.addEventListener(REPORT_PREVIEW_ONLYOFFICE_SYNC, onCustom);
    window.addEventListener("storage", onStorage);

    const poll = window.setInterval(fetchAndApply, 5000);

    return () => {
      es?.close();
      window.removeEventListener(REPORT_PREVIEW_ONLYOFFICE_SYNC, onCustom);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(poll);
    };
  }, [year, fetchAndApply]);

  return {
    refreshReportState: fetchAndApply,
    narrativeRevisionRef,
    moduleTablesRevisionRef,
  };
}
