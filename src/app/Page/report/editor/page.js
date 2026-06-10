"use client";

export const dynamic = "force-dynamic";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from "react";
import LoadingProgressOverlay from "@/app/components/shared/LoadingProgressOverlay";
import PreviewCollaborationBar from "@/app/Page/report/preview/PreviewCollaborationBar";
import { notifyPreviewHubChanged } from "@/app/lib/report/reportPreviewSyncEvents";
import { usePreviewCollaboration } from "@/app/lib/report/usePreviewCollaboration";
import {
  getPreviewTabClientId,
  subscribePreviewWebSocket,
  PREVIEW_WS_EVENTS,
} from "@/app/lib/report/previewWebSocketClient";
import { markOnlyOfficeAutoJoinDismissed } from "@/app/lib/report/onlyOfficeAutoJoinDismiss";

function formatOnlyOfficeError(event) {
  const code = event?.data?.errorCode ?? event?.data?.error ?? "?";
  const desc =
    event?.data?.errorDescription ||
    event?.data?.message ||
    "Could not open document.";
  if (code === -4 || code === "-4") {
    return `${desc} (OnlyOffice cannot download the DOCX — run pnpm onlyoffice:down && pnpm onlyoffice:up, restart pnpm dev, create a new report session.)`;
  }
  return `OnlyOffice error (${code}): ${desc}`;
}

function ReportEditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session") || "";
  const editorRef = useRef(null);
  const docEditorRef = useRef(null);
  const readyRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [documentServerUrl, setDocumentServerUrl] = useState("");
  const reportYear = useMemo(() => {
    const fromMeta = Number(meta?.year);
    if (Number.isFinite(fromMeta)) return fromMeta;
    const m = /shared-report-(\d{4})/.exec(sessionId);
    return m ? parseInt(m[1], 10) : new Date().getFullYear();
  }, [sessionId, meta?.year]);
  const editorPath = useMemo(
    () =>
      sessionId
        ? `/Page/report/editor?session=${encodeURIComponent(sessionId)}`
        : null,
    [sessionId],
  );
  const { participants: collabParticipants, wsConnected: collabWsConnected } =
    usePreviewCollaboration(reportYear, {
      location: "onlyoffice",
      sessionId: sessionId || null,
      editorPath,
    });
  const refreshEditorFileRef = useRef(null);
  const refreshDebounceRef = useRef(null);
  const lastPreviewSyncRevisionRef = useRef(0);
  const metaRef = useRef(null);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const markReady = useCallback(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      setLoading(false);
    }
  }, []);

  const handleOnlyOfficeError = useCallback((event) => {
    setError(formatOnlyOfficeError(event));
    markReady();
  }, [markReady]);

  useEffect(() => {
    const onPageHide = () => {
      if (!Number.isFinite(reportYear)) return;
      void fetch("/api/report/collaboration/exit-onlyoffice", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: reportYear,
          tabId: getPreviewTabClientId(),
          location: "report",
        }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [reportYear]);

  useEffect(() => {
    if (!sessionId || !Number.isFinite(reportYear)) return undefined;
    const unsub = subscribePreviewWebSocket(reportYear, (data) => {
      if (data.type !== PREVIEW_WS_EVENTS.ONLYOFFICE_DOCX_REFRESH) return;
      if (data.sessionId && data.sessionId !== sessionId) return;
      void refreshEditorFileRef.current?.();
    });
    return unsub;
  }, [sessionId, reportYear]);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing report session. Generate a report from the preview page first.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    readyRef.current = false;
    async function initEditor() {
      try {
        const configRes = await fetch(
          `/api/report/onlyoffice/config?sessionId=${encodeURIComponent(sessionId)}&mode=edit`,
          { credentials: "include", cache: "no-store" },
        );
        const configJson = await configRes.json().catch(() => ({}));

        if (!configRes.ok || !configJson.success) {
          if (configJson.documentServerUrl) setDocumentServerUrl(configJson.documentServerUrl);
          try {
            const metaRes = await fetch(
              `/api/report/session?sessionId=${encodeURIComponent(sessionId)}`,
              { credentials: "include" },
            );
            const metaJson = await metaRes.json().catch(() => ({}));
            if (metaJson.success && metaJson.meta) setMeta(metaJson.meta);
          } catch {
            /* ignore */
          }
          throw new Error(configJson.error || `Failed to load editor (${configRes.status})`);
        }

        if (cancelled) return;
        setMeta(configJson.meta || null);
        setDocumentServerUrl(configJson.documentServerUrl || "");

        if (process.env.NODE_ENV === "development" && configJson.documentFileUrl) {
          console.info("[OnlyOffice] document URL for server fetch:", configJson.documentFileUrl);
        }

        const scriptUrl = `${configJson.documentServerUrl}/web-apps/apps/api/documents/api.js`;
        await new Promise((resolve, reject) => {
          if (window.DocsAPI) {
            resolve();
            return;
          }
          const script = document.createElement("script");
          script.src = scriptUrl;
          script.async = true;
          script.dataset.onlyoffice = "1";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Could not load OnlyOffice from ${scriptUrl}`));
          document.body.appendChild(script);
        });

        if (cancelled || !editorRef.current) return;

        const refreshEditorFile = async () => {
          try {
            const refreshRes = await fetch(
              `/api/report/onlyoffice/config?sessionId=${encodeURIComponent(sessionId)}&mode=edit`,
              { credentials: "include", cache: "no-store" },
            );
            const refreshJson = await refreshRes.json().catch(() => ({}));
            if (
              refreshRes.ok &&
              refreshJson.success &&
              docEditorRef.current?.refreshFile &&
              refreshJson.editorConfig
            ) {
              docEditorRef.current.refreshFile(refreshJson.editorConfig);
              setError("");
              markReady();
            }
          } catch {
            /* ignore */
          }
        };
        refreshEditorFileRef.current = refreshEditorFile;

        const events = {
          onError: handleOnlyOfficeError,
          onAppReady: markReady,
          onDocumentReady: markReady,
          onRequestRefreshFile: refreshEditorFile,
          onOutdatedVersion: () => {
            if (refreshDebounceRef.current) {
              window.clearTimeout(refreshDebounceRef.current);
            }
            refreshDebounceRef.current = window.setTimeout(() => {
              void refreshEditorFileRef.current?.();
            }, 1200);
            markReady();
          },
        };

        const base = configJson.editorConfig || {};
        const editorPayload = {
          ...base,
          width: "100%",
          height: "100%",
          events,
        };

        docEditorRef.current = new window.DocsAPI.DocEditor(
          editorRef.current.id,
          editorPayload,
        );

        window.setTimeout(() => markReady(), 800);

        window.setTimeout(() => {
          if (!cancelled && !readyRef.current) {
            setError(
              "Document is still loading. Large reports can take 1–2 minutes. Check terminal for [report/doc/file]. If missing, run: pnpm onlyoffice:down && pnpm onlyoffice:up && restart pnpm dev, then create a new report session.",
            );
            markReady();
          }
        }, 120000);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to initialize editor");
          setLoading(false);
        }
      }
    }

    initEditor();

    return () => {
      cancelled = true;
      if (refreshDebounceRef.current) {
        window.clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
      if (docEditorRef.current?.destroyEditor) {
        try {
          docEditorRef.current.destroyEditor();
        } catch {
          /* ignore */
        }
      }
    };
  }, [sessionId, reportYear, handleOnlyOfficeError, markReady]);

  /** Poll report state DB after OnlyOffice save → updates HTML preview fields. */
  useEffect(() => {
    const reportYear = Number(meta?.year);
    if (!Number.isFinite(reportYear)) return undefined;

    let cancelled = false;
    let baselineSet = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/report/state?year=${encodeURIComponent(String(reportYear))}`,
          { cache: "no-store", credentials: "include" },
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled || !json.success || !json.state) return;
        const rev =
          Number(json.state.hubRevision) ||
          Number(json.state.onlyOfficeSyncRevision) ||
          0;
        if (!baselineSet) {
          lastPreviewSyncRevisionRef.current = rev;
          baselineSet = true;
          return;
        }
        if (rev > lastPreviewSyncRevisionRef.current) {
          lastPreviewSyncRevisionRef.current = rev;
          notifyPreviewHubChanged(reportYear, rev);
        }
      } catch {
        /* ignore */
      }
    };

    poll();
    const id = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [meta?.year]);

  const handleExitToReport = useCallback(() => {
    if (Number.isFinite(reportYear)) {
      markOnlyOfficeAutoJoinDismissed(reportYear);
      void fetch("/api/report/collaboration/exit-onlyoffice", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: reportYear,
          tabId: getPreviewTabClientId(),
          location: "report",
        }),
      }).catch(() => {});
    }
    const params = new URLSearchParams();
    if (Number.isFinite(reportYear)) {
      params.set("year", String(reportYear));
    }
    router.replace(`/Page/report?${params.toString()}`);
  }, [router, reportYear]);

  const downloadFile = async (format) => {
    setDownloading(format);
    try {
      const res = await fetch(
        `/api/report/documents/${encodeURIComponent(sessionId)}/download?format=${format}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const year = meta?.year ?? new Date().getFullYear();
      const ext = format === "pdf" ? "pdf" : "docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KIAS-Consolidated-Report-${year}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(e?.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden relative">
      <div className="fixed bottom-11 left-2 z-20 flex flex-col items-center gap-1 pointer-events-none">
        <PreviewCollaborationBar
          participants={collabParticipants}
          wsConnected={collabWsConnected}
          compact
          vertical
          mini
        />
        <button
          type="button"
          suppressHydrationWarning
          onClick={handleExitToReport}
          title="Exit to report"
          aria-label="Exit to report"
          className="pointer-events-auto shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
      {error && (
        <div className="shrink-0 mx-4 mt-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          <p>{error}</p>
          <p className="mt-2 text-xs">
            Terminal should show{" "}
            <code className="bg-red-100 px-1">[report/doc/file] serve docx</code> when the editor opens.
          </p>
          <p className="mt-2 text-xs">
            <code>NEXT_PUBLIC_ONLYOFFICE_URL</code> must be{" "}
            <code>http://localhost:8082</code> (not <code>/onlyoffice-proxy</code> — WebSocket &
            /cache do not go through Next). Hard refresh after changing .env.
          </p>
        </div>
      )}

      <LoadingProgressOverlay
        open={loading && !error}
        progress={loading && !error ? 92 : 0}
        title="Opening OnlyOffice"
        subtitle={meta?.title || "Consolidated report document"}
        statusLabel="Large reports may take 1–2 minutes…"
      />

      <div className="relative flex-1 min-h-0 flex w-full overflow-hidden">
        <div className="relative flex-1 min-h-0 bg-white">
          <div id="onlyoffice-editor" ref={editorRef} className="absolute inset-0 w-full h-full" />
        </div>
      </div>
    </div>
  );
}

export default function ReportEditorPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Loading editor…</div>}>
      <ReportEditorContent />
    </Suspense>
  );
}
