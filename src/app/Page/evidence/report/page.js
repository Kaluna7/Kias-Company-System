import { Suspense } from "react";
import { getInternalFetchBaseUrl } from "@/lib/getInternalFetchBaseUrl";
import EvidenceReportClient from "./_components/EvidenceReportClient";

async function loadEvidenceReportData(year) {
  try {
    const baseUrl = getInternalFetchBaseUrl();

    const params = new URLSearchParams();
    if (year) {
      params.set("year", String(year));
    }
    // Load enough published rows for the report view
    params.set("pageSize", "500");

    const res = await fetch(`${baseUrl}/api/evidence/report?${params.toString()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("Failed to load evidence report data");
      return [];
    }

    const json = await res.json().catch(() => null);
    if (!json?.success || !Array.isArray(json.data)) {
      return [];
    }

    const rows = json.data.map((row) => ({
      ...row,
      department: row.department || "",
      created_at: row.created_at || row.published_at || null,
      overall_status: row.overall_status || "COMPLETE",
    }));

    rows.sort((a, b) => {
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department);
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return rows;
  } catch (err) {
    console.error("Error loading evidence report data:", err);
    return [];
  }
}

export default async function EvidenceReport({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const data = await loadEvidenceReportData(year);

  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading evidence report...</div>}>
      <EvidenceReportClient initialData={data} />
    </Suspense>
  );
}
