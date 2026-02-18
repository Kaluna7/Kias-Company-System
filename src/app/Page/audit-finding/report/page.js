import { headers } from "next/headers";
import ReportClient from "./ReportClient";

async function loadAuditFindingReportData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

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
        const endpoint = `${baseUrl}/api/audit-finding/${deptInfo.apiPath}`;
        const res = await fetch(endpoint, {
          cache: "no-store",
        });
        
        if (!res.ok) {
          console.warn(`API not available for ${dept}`);
          return [];
        }

        const json = await res.json();
        
        // Handle both formats: { success: true, data: [...] } and { data: [...] }
        const dataArray = json.success && Array.isArray(json.data) ? json.data : (Array.isArray(json.data) ? json.data : []);
        
        console.log(`[Report] ${dept}: Fetched ${dataArray.length} findings from API`);
        
        if (dataArray.length > 0) {
          // Filter hanya data dengan completion_status = "COMPLETED" (case-insensitive)
          const completedData = dataArray.filter(row => {
            const status = row.completion_status?.toUpperCase();
            const isCompleted = status === "COMPLETED";
            if (!isCompleted) {
              console.log(`[Report] ${dept}: Filtered out finding with status: ${row.completion_status}`);
            }
            return isCompleted;
          });
          
          console.log(`[Report] ${dept}: ${completedData.length} findings with COMPLETED status`);
          
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

    // Sort by department and created_at
    allData.sort((a, b) => {
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department);
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return allData;
  } catch (err) {
    console.error("Error loading audit finding report data:", err);
    return [];
  }
}

export default async function AuditFindingReportPage() {
  const initialData = await loadAuditFindingReportData();
  return <ReportClient initialData={initialData} />;
}

