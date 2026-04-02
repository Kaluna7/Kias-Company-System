import { getInternalFetchBaseUrl } from "@/lib/getInternalFetchBaseUrl";
import {
  loadAuditFindingScheduleHistories,
  pickScheduleAsOfFromHistory,
} from "@/lib/auditFindingReportSchedule";
import prisma from "@/app/lib/prisma";
import ReportClient from "./ReportClient";

function normalizeScheduleDate(raw) {
  if (raw == null || raw === "") return null;
  const dateStr = String(raw);
  let out = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out)) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    out = d.toISOString().slice(0, 10);
  }
  return out;
}

/** YYYY-MM-DD in local calendar for comparing publish day vs period end (same idea as worksheet report). */
function toLocalIsoDate(v) {
  if (v == null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadAuditFindingReportData(year) {
  try {
    const baseUrl = getInternalFetchBaseUrl();

    // Map department untuk API endpoint
    // Mapping department_id dari schedule ke department name
    const deptIdToDeptMap = {
      'A1.1': { apiPath: 'finance', deptName: 'FINANCE', scheduleDeptName: 'Sec. Finance' },
      'A1.2': { apiPath: 'accounting', deptName: 'ACCOUNTING', scheduleDeptName: 'Sec. Accounting' },
      'A1.3': { apiPath: 'hrd', deptName: 'HRD', scheduleDeptName: 'Sec. Human Resources (HRD)' },
      'A1.4': { apiPath: 'g&a', deptName: 'G&A', scheduleDeptName: 'Sec. General Affair (GA)' },
      'A1.5': { apiPath: 'sdp', deptName: 'DESIGN STORE PLANNER', scheduleDeptName: 'Sec. Store Design & Planner (SDP)' },
      'A1.6': { apiPath: 'tax', deptName: 'TAX', scheduleDeptName: 'Sec. Tax' },
      'A1.7': { apiPath: 'l&p', deptName: 'SECURITY L&P', scheduleDeptName: 'Sec. Security (L&P)' },
      'A1.8': { apiPath: 'mis', deptName: 'MIS', scheduleDeptName: 'Sec. MIS' },
      'A1.9': { apiPath: 'merch', deptName: 'MERCHANDISE', scheduleDeptName: 'Sec. Merchandise' },
      'A1.10': { apiPath: 'ops', deptName: 'OPERATIONAL', scheduleDeptName: 'Sec. Operational' },
      'A1.11': { apiPath: 'whs', deptName: 'WAREHOUSE', scheduleDeptName: 'Sec. Warehouse' },
    };

    const departmentMap = Object.values(deptIdToDeptMap).reduce((acc, dept) => {
      acc[dept.deptName] = { apiPath: dept.apiPath, deptName: dept.deptName };
      return acc;
    }, {});

    const departments = Object.keys(departmentMap);

    const scheduleHistoryByDeptId = await loadAuditFindingScheduleHistories(prisma);
    const deptNameToScheduleId = Object.fromEntries(
      Object.entries(deptIdToDeptMap).map(([scheduleId, info]) => [info.deptName, scheduleId]),
    );

    // Fetch audit finding data dari semua department
    const allData = [];
    const fetchPromises = departments.map(async (dept) => {
      const deptInfo = departmentMap[dept];
      try {
        const url = new URL(`${baseUrl}/api/audit-finding/${deptInfo.apiPath}`);
        // Report membutuhkan data COMPLETED dari semua tahun; filter tahun dilakukan di layer report,
        // berbasis tanggal publish (updated_at) atau completion_date.
        url.searchParams.set("include_completed", "1");
        const res = await fetch(url.toString(), {
          cache: "no-store",
        });
        
        if (!res.ok) {
          console.warn(`API not available for ${dept}`);
          return [];
        }

        const json = await res.json();
        
        // Handle both formats: { success: true, data: [...] } and { data: [...] }
        const dataArray = json.success && Array.isArray(json.data) ? json.data : (Array.isArray(json.data) ? json.data : []);
        
        if (dataArray.length > 0) {
          // Filter hanya data dengan completion_status = "COMPLETED" (case-insensitive)
          const completedData = dataArray.filter(row => {
            const status = row.completion_status?.toUpperCase();
            return status === "COMPLETED";
          });
          
          // Tambahkan department name, schedule, dan audit period ke setiap row
          // Audit Fieldwork Start: dari start_date schedule module (audit period start)
          // Audit Fieldwork End: dari updated_at (tanggal publish)
          return completedData.map((row) => {
            const deptName = deptInfo.deptName;
            const scheduleDeptId = deptNameToScheduleId[deptName];
            // 1) Snapshot columns set at publish. 2) Else schedule as it was when row was saved (append-only history).
            // Do NOT use "current" module schedule for COMPLETED rows — it would rewrite all old publishes when dates change.
            const storedPs = normalizeScheduleDate(row.report_audit_period_start);
            const storedPe = normalizeScheduleDate(row.report_audit_period_end);
            const storedFs = normalizeScheduleDate(row.report_audit_fieldwork_start);
            const storedFe = normalizeScheduleDate(row.report_audit_fieldwork_end);

            const asOf = row.updated_at ?? row.completion_date;
            const needHistory = !storedPs && !storedPe;
            const hist =
              needHistory && scheduleDeptId
                ? pickScheduleAsOfFromHistory(scheduleHistoryByDeptId[scheduleDeptId], asOf)
                : null;
            const histPs = hist ? normalizeScheduleDate(hist.start_date) : null;
            const histPe = hist ? normalizeScheduleDate(hist.end_date) : null;

            const auditPeriodStart = storedPs ?? histPs ?? null;
            const auditPeriodEnd = storedPe ?? histPe ?? null;
            const fieldworkStart = storedFs ?? auditPeriodStart;
            const fieldworkEndIso = storedFe ?? toLocalIsoDate(row.updated_at);
            const exceedsAuditPeriod = Boolean(
              auditPeriodEnd && fieldworkEndIso && fieldworkEndIso > auditPeriodEnd,
            );

            return {
              ...row,
              department: deptName,
              audit_period_start: auditPeriodStart,
              audit_period_end: auditPeriodEnd,
              audit_fieldwork_start: fieldworkStart,
              audit_fieldwork_end: fieldworkEndIso,
              exceeds_audit_period: exceedsAuditPeriod,
              period_start: auditPeriodStart,
              period_end: auditPeriodEnd,
              fieldwork_start: fieldworkStart,
              fieldwork_end: fieldworkEndIso,
            };
          });
        }
        return [];
      } catch (err) {
        console.warn(`API not available for ${dept}:`, err.message);
        return [];
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    
    // Collect all successful results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        allData.push(...result.value);
      }
    });

    // Jika ada filter tahun dari dashboard, terapkan di sini berbasis tanggal publish/completion
    let filtered = allData;
    if (!Number.isNaN(year) && year) {
      filtered = allData.filter((row) => {
        const baseDate =
          (row.completion_date ? new Date(row.completion_date) : null) ||
          (row.updated_at ? new Date(row.updated_at) : null);
        if (!baseDate || Number.isNaN(baseDate.getTime())) return false;
        return baseDate.getFullYear() === year;
      });
    }

    // Sort by department and publish date (fallback created_at)
    filtered.sort((a, b) => {
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department);
      }
      const da =
        (a.updated_at ? new Date(a.updated_at) : null) ||
        (a.completion_date ? new Date(a.completion_date) : null) ||
        (a.created_at ? new Date(a.created_at) : null) ||
        new Date(0);
      const db =
        (b.updated_at ? new Date(b.updated_at) : null) ||
        (b.completion_date ? new Date(b.completion_date) : null) ||
        (b.created_at ? new Date(b.created_at) : null) ||
        new Date(0);
      return db - da;
    });

    return filtered;
  } catch (err) {
    console.error("Error loading audit finding report data:", err);
    return [];
  }
}

export default async function AuditFindingReportPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const initialData = await loadAuditFindingReportData(year);
  return <ReportClient initialData={initialData} selectedYear={year} />;
}

