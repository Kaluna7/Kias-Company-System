import { getInternalFetchBaseUrl } from "@/lib/getInternalFetchBaseUrl";
import ReportClient from "./ReportClient";

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

    // Fetch schedule data untuk audit-finding module (audit period)
    let scheduleData = {}; // Key: deptName, Value: { period_start, period_end }
    try {
      const scheduleRes = await fetch(`${baseUrl}/api/schedule/module?module=audit-finding`, {
        next: { revalidate: 30 },
      });
      if (scheduleRes.ok) {
        const scheduleJson = await scheduleRes.json();
        if (scheduleJson.success && Array.isArray(scheduleJson.rows)) {
          scheduleJson.rows.forEach((row) => {
            const deptId = row.department_id;
            const deptInfo = deptIdToDeptMap[deptId];
            if (deptInfo) {
              // Schedule module untuk audit-finding: start_date dan end_date adalah audit period
              scheduleData[deptInfo.deptName] = {
                period_start: row.start_date, // Audit period start = schedule start_date (dari schedule module)
                period_end: row.end_date, // Audit period end = schedule end_date (dari schedule module)
              };
            }
          });
        }
      }
    } catch (err) {
      console.warn("Error fetching schedule data:", err);
    }

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
          return completedData.map(row => {
            // Format updated_at to date string (YYYY-MM-DD) for fieldwork_end
            let fieldworkEnd = null;
            if (row.updated_at) {
              try {
                const date = new Date(row.updated_at);
                if (!isNaN(date.getTime())) {
                  fieldworkEnd = date.toISOString().split('T')[0];
                }
              } catch (err) {
                console.warn(`Error parsing updated_at for row:`, err);
              }
            }
            
            return {
              ...row,
              department: deptInfo.deptName,
              fieldwork_start: scheduleData[dept]?.period_start || null, // Fieldwork start = schedule start_date (audit period start)
              fieldwork_end: fieldworkEnd, // Fieldwork end = updated_at (tanggal publish)
              period_start: scheduleData[dept]?.period_start || null,
              period_end: scheduleData[dept]?.period_end || null,
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
  return <ReportClient initialData={initialData} />;
}

