"use client";

export const dynamic = "force-dynamic";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import LoadingProgressOverlay from "@/app/components/shared/LoadingProgressOverlay";
import ReportEditorAiPanel from "./ReportEditorAiPanel";
import { notifyPreviewHubChanged } from "@/app/lib/report/reportPreviewSyncEvents";
import { regenerateReportDocxFromModules } from "@/app/lib/report/exportReportClient";
import { SOP_REVIEW_DATA_CHANGED_KEY } from "@/app/lib/sop-review/sopReviewNotifyClient";

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
  const [aiStatus, setAiStatus] = useState("");
  const [previewSyncStatus, setPreviewSyncStatus] = useState("");
  const [collabHint, setCollabHint] = useState("");
  const refreshEditorFileRef = useRef(null);
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
        const creator = configJson.meta?.createdBy?.name;
        if (creator) {
          setCollabHint(
            `Kolaborasi: dokumen tahun ${configJson.meta?.year ?? ""} — dibuat oleh ${creator}. User lain membuka editor yang sama akan masuk ke dokumen ini.`,
          );
        } else {
          setCollabHint(
            "Kolaborasi: semua user membuka laporan tahun yang sama memakai dokumen Word bersama.",
          );
        }
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
          // Do not auto-refresh on outdated — that retriggers OnlyOffice "Version changed" in a loop.
          onOutdatedVersion: () => {
            setError(
              "The document was updated on the server. Close this tab, then use Create report on the Report page to open the latest file.",
            );
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
      if (docEditorRef.current?.destroyEditor) {
        try {
          docEditorRef.current.destroyEditor();
        } catch {
          /* ignore */
        }
      }
    };
  }, [sessionId, handleOnlyOfficeError, markReady]);

  /** SOP / Audit module edits → rebuild DOCX and refresh OnlyOffice file. */
  useEffect(() => {
    const reportYear = Number(meta?.year);
    if (!Number.isFinite(reportYear)) return undefined;

    let regenTimer = null;
    const scheduleRegen = () => {
      window.clearTimeout(regenTimer);
      regenTimer = window.setTimeout(async () => {
        setPreviewSyncStatus("Memperbarui Word (modul + lock/unlock, narasi OnlyOffice tetap)...");
        const regen = await regenerateReportDocxFromModules(reportYear);
        if (regen.ok) {
          await refreshEditorFileRef.current?.();
          setPreviewSyncStatus(
            "Word diperbarui — tabel modul mengikuti lock/unlock; narasi dari simpanan OnlyOffice.",
          );
        } else {
          setPreviewSyncStatus(
            regen.error || "Gagal memperbarui Word. Tutup editor, buka dari Report preview.",
          );
        }
      }, 1500);
    };

    const onSopChanged = (e) => {
      const y =
        e.detail?.reportYear != null
          ? Number(e.detail.reportYear)
          : e.detail?.year != null
            ? Number(e.detail.year)
            : null;
      if (y != null && Number.isFinite(y) && y !== reportYear) return;
      scheduleRegen();
    };

    const onModulesSynced = (e) => {
      const detail = e.detail || {};
      const y =
        detail.reportYear != null
          ? Number(detail.reportYear)
          : detail.year != null
            ? Number(detail.year)
            : null;
      if (y != null && Number.isFinite(y) && y !== reportYear) return;
      scheduleRegen();
    };

    window.addEventListener(SOP_REVIEW_DATA_CHANGED_KEY, onSopChanged);
    window.addEventListener("kias-report-modules-synced", onModulesSynced);
    return () => {
      window.clearTimeout(regenTimer);
      window.removeEventListener(SOP_REVIEW_DATA_CHANGED_KEY, onSopChanged);
      window.removeEventListener("kias-report-modules-synced", onModulesSynced);
    };
  }, [meta?.year]);

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
          setPreviewSyncStatus(
            "Saved — HTML preview updated from OnlyOffice.",
          );
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
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {aiStatus && !error && (
        <div className="shrink-0 mx-4 mt-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs">
          {aiStatus}
        </div>
      )}
      {collabHint && !error && (
        <div className="shrink-0 mx-4 mt-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-100 text-sky-900 text-xs">
          {collabHint}
        </div>
      )}
      {previewSyncStatus && !error && (
        <div className="shrink-0 mx-4 mt-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-900 text-xs">
          {previewSyncStatus}
        </div>
      )}
      {error && (
        <div className="shrink-0 mx-4 mt-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          <p>{error}</p>
          <p className="mt-2 text-xs">
            Terminal harus menampilkan{" "}
            <code className="bg-red-100 px-1">[report/doc/file] serve docx</code> saat editor dibuka.
          </p>
          <p className="mt-2 text-xs">
            <code>NEXT_PUBLIC_ONLYOFFICE_URL</code> harus{" "}
            <code>http://localhost:8082</code> (bukan <code>/onlyoffice-proxy</code> — WebSocket &
            /cache tidak lewat Next). Hard refresh setelah ubah .env.
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
        <ReportEditorAiPanel
          sessionId={sessionId}
          docEditorRef={docEditorRef}
          onRefreshDocument={() => refreshEditorFileRef.current?.()}
          onStatus={setAiStatus}
        />
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
