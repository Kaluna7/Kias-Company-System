import { headers } from "next/headers";
import ReportClient from "./ReportClient";

async function loadWorksheetReportData(year) {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    // Map department untuk API endpoint
    const departmentMap = {
      'FINANCE': '/api/worksheet/finance',
      'ACCOUNTING': '/api/worksheet/accounting',
      'HRD': '/api/worksheet/hrd',
      'G&A': '/api/worksheet/g&a',
      'DESIGN STORE PLANNER': '/api/worksheet/sdp',
      'TAX': '/api/worksheet/tax',
      'SECURITY L&P': '/api/worksheet/l&p',
      'MIS': '/api/worksheet/mis',
      'MERCHANDISE': '/api/worksheet/merch',
      'OPERATIONAL': '/api/worksheet/ops',
      'WAREHOUSE': '/api/worksheet/whs',
    };

    const allData = [];
    const departments = Object.keys(departmentMap);

    // Fetch data dari semua department secara parallel
    const fetchPromises = departments.map(async (dept) => {
      try {
        const endpoint = departmentMap[dept];
        const url = new URL(`${baseUrl}${endpoint}`);
        if (!Number.isNaN(year) && year) {
          url.searchParams.set("year", String(year));
        }

        const res = await fetch(url.toString(), {
          next: { revalidate: 0 },
        });
        
        if (!res.ok) {
          console.log(`API not available for ${dept}`);
          return [];
        }

        const json = await res.json();
        
        if (json.success && Array.isArray(json.rows)) {
          // Tambahkan department name ke setiap row
          return json.rows.map(row => ({
            ...row,
            department: dept,
          }));
        }
        return [];
      } catch (err) {
        // Skip jika API tidak tersedia untuk department tertentu
        console.log(`API not available for ${dept}:`, err.message);
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
    console.error("Error loading worksheet report data:", err);
    return [];
  }
}

export default async function WorksheetReportPage({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam, 10) : null;

  const initialData = await loadWorksheetReportData(year);
  
  return <ReportClient initialData={initialData} />;
}
