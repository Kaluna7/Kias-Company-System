import { headers } from "next/headers";
import ReportClient from "./ReportClient";
import { buttonSopReview } from "@/app/data/sopReviewConfig";

export const dynamic = "force-dynamic";

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

const DEPT_TO_SCHEDULE_ID = {
  FINANCE: "A1.1",
  ACCOUNTING: "A1.2",
  HRD: "A1.3",
  "G&A": "A1.4",
  SDP: "A1.5",
  TAX: "A1.6",
  "L&P": "A1.7",
  MIS: "A1.8",
  MERCHANDISE: "A1.9",
  OPERATIONAL: "A1.10",
  WAREHOUSE: "A1.11",
};

async function loadScheduleModuleData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;
    const res = await fetch(`${baseUrl}/api/schedule/module?module=sop-review`, { cache: "no-store" });
    const data = await res.json();
    if (data.success && Array.isArray(data.rows)) {
      const scheduleMap = {};
      data.rows.forEach((row) => {
        if (row.department_id && row.is_configured) {
          let formattedStartDate = row.start_date;
          let formattedEndDate = row.end_date;
          if (row.start_date) {
            const dateStr = String(row.start_date);
            formattedStartDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.slice(0, 10);
            if (!formattedStartDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const dateObj = new Date(row.start_date);
              if (!isNaN(dateObj.getTime())) formattedStartDate = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
            }
          }
          if (row.end_date) {
            const dateStr = String(row.end_date);
            formattedEndDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.slice(0, 10);
            if (!formattedEndDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const dateObj = new Date(row.end_date);
              if (!isNaN(dateObj.getTime())) formattedEndDate = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
            }
          }
          scheduleMap[row.department_id] = { start_date: formattedStartDate, end_date: formattedEndDate, user_name: row.user_name || "" };
        }
      });
      return scheduleMap;
    }
    return {};
  } catch (err) {
    console.error("Error loading schedule module data:", err);
    return {};
  }
}

async function loadReportData(year) {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;
  const scheduleMap = await loadScheduleModuleData();
  const depts = buttonSopReview.filter((b) => b.name !== "Report");
  const results = await Promise.allSettled(
    depts.map(async (b) => {
      const map = DEPT_TO_API[b.name];
      if (!map) return null;
      const apiPath = map.api;
      try {
        // Ambil SEMUA data publish dari SOP Review Report,
        // filtering tahun akan dilakukan di layer aplikasi di bawah (berdasarkan audit_period_start/published_at)
        const params = new URLSearchParams({ all: "1" });
        const publishedRes = await fetch(
          `${baseUrl}/api/SopReview/${apiPath}/published?${params.toString()}`,
          { cache: "no-store" },
        );
        const publishedJson = await publishedRes.json().catch(() => ({}));
        const publishes = publishedRes.ok && Array.isArray(publishedJson.publishes) ? publishedJson.publishes : [];
        console.log("[SOP-REPORT] raw publishes", {
          dept: map.dept,
          apiPath,
          publishesCount: publishes.length,
          yearFilter: year,
          sampleMeta: publishes[0]?.meta || null,
        });
        const scheduleDeptId = DEPT_TO_SCHEDULE_ID[map.dept];
        const scheduleData = scheduleDeptId ? scheduleMap[scheduleDeptId] : null;
        let audit_period_start = "#####";
        let audit_period_end = "#####";
        if (scheduleData?.start_date) {
          const dateStr = String(scheduleData.start_date);
          audit_period_start = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.slice(0, 10);
          if (!audit_period_start.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const dateObj = new Date(scheduleData.start_date);
            if (!isNaN(dateObj.getTime())) audit_period_start = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
            else audit_period_start = "#####";
          }
        }
        if (scheduleData?.end_date) {
          const dateStr = String(scheduleData.end_date);
          audit_period_end = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.slice(0, 10);
          if (!audit_period_end.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const dateObj = new Date(scheduleData.end_date);
            if (!isNaN(dateObj.getTime())) audit_period_end = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
            else audit_period_end = "#####";
          }
        }
        return publishes.map(({ meta, rows }) => ({
          apiPath,
          department: map.dept,
          meta,
          steps: (rows || []).map((r, idx) => ({
            no: r.no ?? idx + 1,
            sop_related: r.sop_related || "",
            status: r.status || "DRAFT",
            comment: r.comment || "",
            reviewer: r.reviewer || "",
          })),
          audit_period_start,
          audit_period_end,
          preparer: meta?.preparer_name || scheduleData?.user_name || "",
          published_at: meta?.published_at || null,
          audit_fieldwork_start_date: meta?.audit_fieldwork_start_date || null,
          audit_fieldwork_end_date: meta?.audit_fieldwork_end_date || null,
        }));
      } catch (e) {
        console.warn(`Failed to load data for ${b.name}:`, e.message);
        return [];
      }
    })
  );
  const allRows = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (Array.isArray(r.value) ? r.value : r.value ? [r.value] : []))
    // Hanya baris yang benar‑benar sudah dipublish (punya published_at di meta/row)
    .filter((row) => (row.meta?.published_at || row.published_at) != null);

  console.log("[SOP-REPORT] allRows after publish filter", {
    total: allRows.length,
    yearFilter: year,
    departments: Array.from(new Set(allRows.map((r) => r.department))),
  });

  if (!year || Number.isNaN(year)) {
    return allRows;
  }

  // Filter tahun dengan logika yang toleran:
  // 1) Jika audit_period_start valid date → pakai tahunnya
  // 2) Jika audit_period_start kosong / placeholder ("#####"/"no-period") → pakai tahun published_at
  return allRows.filter((row) => {
    const aps = row.audit_period_start;
    const pub = row.meta?.published_at || row.published_at || null;
    if (aps && aps !== "#####" && aps !== "no-period") {
      const d = new Date(aps);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === year) return true;
      // Jika tanggal period ada tapi tidak valid / beda tahun, jangan langsung buang;
      // jatuhkan ke published_at sebagai fallback.
    }
    const d = pub ? new Date(pub) : new Date("invalid");
    return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
  });
}

async function loadScheduleData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
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

export default async function ReportSOP({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const [rows, scheduleData] = await Promise.all([loadReportData(year), loadScheduleData()]);
  return <ReportClient initialRows={rows} initialScheduleData={scheduleData} selectedYear={year || null} />;
}
