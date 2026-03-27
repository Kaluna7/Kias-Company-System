"use client";

export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ReportPageContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  const handleCreateReport = () => {
    // Buka halaman preview (cover) di tab baru, di sana akan muncul popup print
    const url = new URL("/Page/report/preview", window.location.origin);
    if (Number.isFinite(year)) {
      url.searchParams.set("year", String(year));
    }
    window.open(url.toString(), "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
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
            </div>
          </div>
        </header>

        <main className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleCreateReport}
              className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
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
              Create Report
            </button>
          </div>
        </main>
      </div>
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

