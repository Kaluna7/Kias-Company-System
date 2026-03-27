"use client";

export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RiskAssessmentReportPageContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const handleCreateReport = () => {
    // Placeholder action – saat ini hanya alert.
    // Nanti bisa diganti untuk generate / download report sesungguhnya.
    alert(`Create report for year ${year}`);
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/Page/risk-assessment-dashboard";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </button>
        </div>
        <header className="mb-8">
          <div className="bg-gradient-to-r from-[#141D38] to-[#1a2747] rounded-2xl shadow-xl p-6 border border-slate-800/40">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Risk Assessment Report
                </h1>
                <p className="text-blue-200 mt-1 text-sm md:text-base">
                  Generate consolidated risk assessment report for year{" "}
                  <span className="font-semibold">{year}</span>.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <div className="space-y-4">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">
              Create Report
            </h2>
            <p className="text-sm text-gray-600">
              This page is reserved for building the consolidated risk assessment report.
              Click the button below to start the report creation process for year{" "}
              <span className="font-semibold text-gray-800">{year}</span>.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCreateReport}
                className="inline-flex items-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
              >
                <svg
                  className="w-4 h-4 mr-2"
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
                Create Report
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function RiskAssessmentReportPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <RiskAssessmentReportPageContent />
    </Suspense>
  );
}

