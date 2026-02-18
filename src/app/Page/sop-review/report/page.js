import { headers } from "next/headers";
import ReportClient from "./ReportClient";
import { buttonSopReview } from "@/app/data/sopReviewConfig";

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

async function loadReportData() {
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
        const publishedRes = await fetch(`${baseUrl}/api/SopReview/${apiPath}/published`, { cache: "no-store" });
        const publishedJson = await publishedRes.json().catch(() => ({}));
        const meta = publishedRes.ok ? publishedJson.meta || null : null;
        const steps = publishedRes.ok && Array.isArray(publishedJson.rows) ? publishedJson.rows : [];
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
        const preparer = scheduleData?.user_name || "";
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
          audit_period_start,
          audit_period_end,
          preparer,
          published_at: meta?.published_at || null,
          audit_fieldwork_start_date: meta?.audit_fieldwork_start_date || null,
          audit_fieldwork_end_date: meta?.audit_fieldwork_end_date || null,
        };
      } catch (e) {
        console.warn(`Failed to load data for ${b.name}:`, e.message);
        return { apiPath, department: map.dept, meta: null, steps: [], audit_period_start: "#####", audit_period_end: "#####", preparer: "" };
      }
    })
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value)
    .filter((row) => (row.meta?.published_at || row.published_at) != null);
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

export default async function ReportSOP() {
  const [rows, scheduleData] = await Promise.all([loadReportData(), loadScheduleData()]);
  return <ReportClient initialRows={rows} initialScheduleData={scheduleData} />;
}
