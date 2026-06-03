"use client";

export const dynamic = "force-dynamic";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { preloadLoadingAnimation } from "@/app/components/shared/LoadingProgressOverlay";
import { clearClientReportProgress } from "@/app/lib/report/reportProgressStorage";

if (typeof window !== "undefined") {
  preloadLoadingAnimation();
}

function ReportPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const [resetModal, setResetModal] = useState(null); // null | "confirm" | "success" | "error"
  const [resetErrorMessage, setResetErrorMessage] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleCreateReport = () => {
    const params = new URLSearchParams();
    if (Number.isFinite(year)) {
      params.set("year", String(year));
    }
    params.set("onlyOfficeCreate", "1");
    router.push(`/Page/report/preview?${params.toString()}`);
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
      clearClientReportProgress(year);
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
              if (typeof window === "undefined") return;
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
              window.location.href = "/Page/dashboard";
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
                  Create overall report for year{" "}
                  <span className="font-semibold">{year}</span>.
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
              onClick={handleCreateReport}
              className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-semibold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create &amp; edit report (OnlyOffice)
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
