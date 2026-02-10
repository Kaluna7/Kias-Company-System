import { headers } from 'next/headers';
import { buttonSopReview } from "@/app/data/sopReviewConfig";
import ReportClient from "./_components/ReportClient";

const DEPT_TO_API = {
  Finnance: { api: "finance", dept: "FINANCE" },
  Finance: { api: "finance", dept: "FINANCE" },
  Accounting: { api: "accounting", dept: "ACCOUNTING" },
  HRD: { api: "hrd", dept: "HRD" },
  "General Affair": { api: "g&a", dept: "G&A" },
  "Store D & P": { api: "sdp", dept: "SDP" },
  Tax: { api: "tax", dept: "TAX" },
  "L & P": { api: "l&p", dept: "L&P" },
  MIS: { api: "mis", dept: "MIS" },
  Merchandise: { api: "merch", dept: "MERCHANDISE" },
  Operational: { api: "ops", dept: "OPERATIONAL" },
  Warehouse: { api: "whs", dept: "WAREHOUSE" },
};

// Server-side function to load report data
async function loadReportData() {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;

  const depts = buttonSopReview.filter((b) => b.name !== "Report");
  const results = await Promise.allSettled(
    depts.map(async (b) => {
      const map = DEPT_TO_API[b.name];
      if (!map) return null;
      const apiPath = map.api;
      try {
        const [publishedRes, periodRes] = await Promise.all([
          fetch(`${baseUrl}/api/SopReview/${apiPath}/published`, { cache: "no-store" }),
          fetch(`${baseUrl}/api/SopReview/${apiPath}/audit-period`, { cache: "default", next: { revalidate: 60 } }),
        ]);
        const [publishedJson, periodJson] = await Promise.all([
          publishedRes.json().catch(() => ({})),
          periodRes.json().catch(() => ({})),
        ]);

        const meta = publishedRes.ok ? (publishedJson.meta || null) : null;
        const steps = publishedRes.ok && Array.isArray(publishedJson.rows) ? publishedJson.rows : [];
        const period =
          periodRes.ok && Array.isArray(periodJson.rows) && periodJson.rows.length > 0 ? periodJson.rows[0] : null;

        return {
          apiPath,
          department: map.dept,
          meta,
          steps: steps.map((r, idx) => ({
            no: r.no ?? idx + 1,
            sop_related: r.sop_related || "",
            status: r.status || "DRAFT",
            comment: r.comment || "",
            reviewer: r.reviewer || "",
          })),
          audit_period_start: period?.audit_period_start || "#####",
          audit_period_end: period?.audit_period_end || "#####",
        };
      } catch (e) {
        console.warn(`Failed to load data for ${b.name}:`, e.message);
        return { apiPath, department: map.dept, meta: null, steps: [], audit_period_start: "#####", audit_period_end: "#####" };
      }
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
}

// Server-side function to load schedule data
async function loadScheduleData() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    const res = await fetch(`${baseUrl}/api/schedule`, { cache: "default", next: { revalidate: 60 } });
    const data = await res.json();
    if (data.success && data.rows) return data.rows;
    return [];
  } catch (err) {
    console.error("Error loading schedule data:", err);
    return [];
  }
}

export default async function ReportSOP() {
  // Load data on server side
  const [rows, scheduleData] = await Promise.all([
    loadReportData(),
    loadScheduleData(),
  ]);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="p-6">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">SOP Review Report</h1>
          <p className="text-sm text-slate-600">Comprehensive overview of all department SOP reviews and audit periods</p>
        </div>

        {/* Client Component for Interactive Parts */}
        <ReportClient initialRows={rows} initialScheduleData={scheduleData} />
      </div>
    </div>
  );
}


