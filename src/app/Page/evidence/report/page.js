import { headers } from "next/headers";
import EvidenceReportClient from "./_components/EvidenceReportClient";

// Map department untuk API endpoint
const departmentMap = {
  'FINANCE': 'finance',
  'ACCOUNTING': 'accounting',
  'OPERATIONAL': 'ops',
  'HRD': 'hrd',
  'G&A': 'g&a',
  'SDP': 'sdp',
  'TAX': 'tax',
  'L&P': 'l&p',
  'MIS': 'mis',
  'MERCHANDISE': 'merch',
  'WAREHOUSE': 'whs',
};

async function loadEvidenceReportData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const allData = [];
    const departments = Object.keys(departmentMap);

    // Fetch data dari semua department
    for (const dept of departments) {
      try {
        const apiSlug = departmentMap[dept];
        const res = await fetch(`${baseUrl}/api/evidence/${apiSlug}?department=${dept}`, {
          next: { revalidate: 30 },
        });
        
        if (res.ok) {
          const json = await res.json();
          
          if (json.success && Array.isArray(json.data)) {
            // Tambahkan department name ke setiap row
            // Only include rows that have been saved as evidence (have id from evidence table)
            // The 'id' field indicates that this record exists in the evidence table
            json.data.forEach(row => {
              // Only include if it has been saved as evidence (has id from evidence table)
              // This means the user has clicked Save at least once
              if (row.id != null && row.ap_id && row.ap_code) {
                allData.push({
                  ...row,
                  // normalize: new API returns `attachment`, old one had `file_url`
                  file_url: row.file_url || row.attachment || "",
                  // meta is returned per department
                  preparer: row.preparer || json?.meta?.preparer || "",
                  overall_status: row.overall_status || json?.meta?.overall_status || "",
                  department: dept,
                });
              }
            });
          }
        }
      } catch (err) {
        // Skip jika API tidak tersedia untuk department tertentu
        console.warn(`Error fetching evidence for ${dept}:`, err.message);
      }
    }

    // Sort by department and created_at
    allData.sort((a, b) => {
      if (a.department !== b.department) {
        return a.department.localeCompare(b.department);
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return allData;
  } catch (err) {
    console.error("Error loading evidence report data:", err);
    return [];
  }
}

export default async function EvidenceReport() {
  const data = await loadEvidenceReportData();

  return <EvidenceReportClient initialData={data} />;
}

