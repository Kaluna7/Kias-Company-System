"use client";

export const dynamic = "force-dynamic";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { markClientReportReset } from "@/app/lib/report/reportProgressStorage";
import { getReportCollaborationStatus } from "@/app/lib/report/exportReportClient";
import { usePreviewCollaboration } from "@/app/lib/report/usePreviewCollaboration";
import { clearOnlyOfficeAutoJoinDismissed } from "@/app/lib/report/onlyOfficeAutoJoinDismiss";
function ReportPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [resetModal, setResetModal] = useState(null); // null | "confirm" | "success" | "error"
  const [resetErrorMessage, setResetErrorMessage] = useState("");
  const [resetting, setResetting] = useState(false);
  const [openingReport, setOpeningReport] = useState(false);

  usePreviewCollaboration(year, { location: "report" });

  useEffect(() => {
    const resetUiState = () => {
      setOpeningReport(false);
      setResetting(false);
    };
    resetUiState();
    const onPageShow = () => resetUiState();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const handleOpenReport = async () => {
    const params = new URLSearchParams();
    if (Number.isFinite(year)) {
      params.set("year", String(year));
    }

    setOpeningReport(true);
    try {
      const collab = await getReportCollaborationStatus(year);
      clearOnlyOfficeAutoJoinDismissed(year);
      // Join OnlyOffice only when someone is actively in the editor right now.
      if (collab.ok && collab.onlyOfficeTeammateLive && collab.editorPath) {
        router.replace(collab.editorPath);
        return;
      }
      router.push(`/Page/report/preview?${params.toString()}`);
    } finally {
      setOpeningReport(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/report/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setResetErrorMessage(json.error || "Reset failed. Please try again.");
        setResetModal("error");
        return;
      }
      markClientReportReset(year, json.resetGeneration ?? 0);
      setResetModal("success");
    } catch (err) {
      setResetErrorMessage(err?.message || "Reset failed. Please try again.");
      setResetModal("error");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              if (Number.isFinite(year)) {
                params.set("year", String(year));
              }
              const query = params.toString();
              router.push(query ? `/Page/dashboard?${query}` : "/Page/dashboard");
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <header className="mb-8">
          <div className="bg-gradient-to-r from-[#141D38] to-[#1a2747] rounded-2xl shadow-xl p-6 border border-slate-800/40">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  KIAS Consolidated Report
                </h1>
                <p className="text-blue-200 mt-1 text-sm md:text-base">
                  Open the shared report for year{" "}
                  <span className="font-semibold">{year}</span> — starts in HTML Preview; joins
                  OnlyOffice only when a teammate is actively editing Word right now.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetModal("confirm")}
                disabled={resetting}
                className="shrink-0 inline-flex items-center self-start md:self-center px-5 py-2.5 rounded-xl border border-red-300/50 bg-red-500/15 text-red-100 text-sm font-semibold hover:bg-red-500/25 disabled:opacity-60 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </header>

        <main className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <div className="flex items-center justify-center py-6">
            <button
              type="button"
              onClick={handleOpenReport}
              disabled={openingReport}
              className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-semibold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {openingReport ? "Opening…" : "Open Report"}
            </button>
          </div>
        </main>
      </div>

      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-reset-dialog-title"
          >
            {resetModal === "confirm" && (
              <>
                <h2 id="report-reset-dialog-title" className="text-lg font-bold text-slate-900 mb-2">
                  Reset report progress?
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Are you sure you want to reset? Your progress will refresh and it can&apos;t be
                  undone.
                </p>
                <p className="text-xs text-slate-500 mb-6">
                  This clears saved draft text for {year} in this browser and removes the generated
                  DOCX session on the server. You will start fresh on the next create.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResetModal(null)}
                    disabled={resetting}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    disabled={resetting}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                  >
                    {resetting ? "Resetting..." : "Yes, reset"}
                  </button>
                </div>
              </>
            )}

            {resetModal === "success" && (
              <>
                <h2 id="report-reset-dialog-title" className="text-lg font-bold text-slate-900 mb-2">
                  Reset complete
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Report progress for <span className="font-semibold">{year}</span> has been reset.
                  You can create a fresh report when ready.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setResetModal(null)}
                    className="px-4 py-2 rounded-lg bg-[#141D38] text-white text-sm font-semibold hover:bg-[#1a2747]"
                  >
                    OK
                  </button>
                </div>
              </>
            )}

            {resetModal === "error" && (
              <>
                <h2 id="report-reset-dialog-title" className="text-lg font-bold text-slate-900 mb-2">
                  Reset failed
                </h2>
                <p className="text-sm text-red-700 leading-relaxed mb-6">{resetErrorMessage}</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setResetModal(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <ReportPageContent />
    </Suspense>
  );
}
