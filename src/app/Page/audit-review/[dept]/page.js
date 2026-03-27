import { headers } from "next/headers";
import AuditReviewDeptClient from "./_components/AuditReviewDeptClient";

// Map department to API path and display info
const deptMap = {
  finance: { apiPath: "finance", deptName: "FINANCE", titleCode: "C1.1" },
  accounting: { apiPath: "accounting", deptName: "ACCOUNTING", titleCode: "C1.2" },
  hrd: { apiPath: "hrd", deptName: "HRD", titleCode: "C1.3" },
  "g&a": { apiPath: "g&a", deptName: "G&A", titleCode: "C1.4" },
  ga: { apiPath: "g&a", deptName: "G&A", titleCode: "C1.4" },
  sdp: { apiPath: "sdp", deptName: "STORE DESIGN PLANNER", titleCode: "C1.5" },
  tax: { apiPath: "tax", deptName: "TAX", titleCode: "C1.6" },
  "l&p": { apiPath: "l&p", deptName: "SECURITY L&P", titleCode: "C1.7" },
  lp: { apiPath: "l&p", deptName: "SECURITY L&P", titleCode: "C1.7" },
  mis: { apiPath: "mis", deptName: "MIS", titleCode: "C1.8" },
  merch: { apiPath: "merch", deptName: "MERCHANDISE", titleCode: "C1.9" },
  ops: { apiPath: "ops", deptName: "OPERATIONAL", titleCode: "C1.10" },
  whs: { apiPath: "whs", deptName: "WAREHOUSE", titleCode: "C1.11" },
};

async function loadAuditReviewData(dept) {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const deptInfo = deptMap[dept];
    if (!deptInfo) {
      return { findings: [], executiveSummary: null, schedule: null };
    }

    // Fetch audit finding report data (completed findings only)
    let findings = [];
    try {
      const findingsRes = await fetch(`${baseUrl}/api/audit-finding/${encodeURIComponent(deptInfo.apiPath)}?include_completed=1`, {
        next: { revalidate: 30 },
      });
      if (findingsRes.ok) {
        const findingsJson = await findingsRes.json();
        const dataArray = findingsJson.success && Array.isArray(findingsJson.data) 
          ? findingsJson.data 
          : (Array.isArray(findingsJson.data) ? findingsJson.data : []);
        
        // Filter only completed findings
        findings = dataArray.filter(row => {
          const status = row.completion_status?.toUpperCase();
          return status === "COMPLETED";
        });
      }
    } catch (err) {
      console.warn(`Error fetching findings for ${dept}:`, err);
    }

    // Fetch executive summary data
    let executiveSummary = null;
    try {
      const summaryRes = await fetch(`${baseUrl}/api/audit-review/${deptInfo.apiPath}/executive-summary`, {
        next: { revalidate: 30 },
      });
      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        if (summaryJson.success && summaryJson.data) {
          executiveSummary = summaryJson.data;
        }
      }
    } catch (err) {
      console.warn(`Error fetching executive summary for ${dept}:`, err);
    }

    // Fetch schedule data
    let schedule = null;
    try {
      const scheduleRes = await fetch(`${baseUrl}/api/schedule/module?module=audit-finding`, {
        next: { revalidate: 30 },
      });
      if (scheduleRes.ok) {
        const scheduleJson = await scheduleRes.json();
        if (scheduleJson.success && Array.isArray(scheduleJson.rows)) {
          const deptIdMap = {
            finance: "A1.1",
            accounting: "A1.2",
            hrd: "A1.3",
            "g&a": "A1.4",
            ga: "A1.4",
            sdp: "A1.5",
            tax: "A1.6",
            "l&p": "A1.7",
            lp: "A1.7",
            mis: "A1.8",
            merch: "A1.9",
            ops: "A1.10",
            whs: "A1.11",
          };
          const deptId = deptIdMap[dept];
          const scheduleRow = scheduleJson.rows.find(row => row.department_id === deptId && row.is_configured === true);
          if (scheduleRow) {
            schedule = {
              start_date: scheduleRow.start_date,
              end_date: scheduleRow.end_date,
            };
          }
        }
      }
    } catch (err) {
      console.warn(`Error fetching schedule for ${dept}:`, err);
    }

    const scheduleYear =
      schedule?.end_date
        ? new Date(schedule.end_date).getFullYear()
        : schedule?.start_date
          ? new Date(schedule.start_date).getFullYear()
          : new Date().getFullYear();

    // Fetch saved audit-review findings first, because report preview must follow reviewed data.
    let reviewedFindings = [];
    try {
      const reviewedFindingsRes = await fetch(
        `${baseUrl}/api/audit-review/${encodeURIComponent(deptInfo.apiPath)}/findings?year=${encodeURIComponent(String(scheduleYear))}`,
        {
          next: { revalidate: 30 },
        },
      );
      if (reviewedFindingsRes.ok) {
        const reviewedJson = await reviewedFindingsRes.json();
        reviewedFindings = Array.isArray(reviewedJson.rows) ? reviewedJson.rows : [];
      }
    } catch (err) {
      console.warn(`Error fetching reviewed findings for ${dept}:`, err);
    }

    return { findings, reviewedFindings, executiveSummary, schedule };
  } catch (err) {
    console.error(`Error loading audit review data for ${dept}:`, err);
    return { findings: [], reviewedFindings: [], executiveSummary: null, schedule: null };
  }
}

export default async function AuditReviewDeptPage({ params }) {
  const p = await Promise.resolve(params);
  const rawDept = String(p?.dept || "");
  let dept = rawDept;
  try {
    dept = decodeURIComponent(rawDept);
  } catch {
    dept = rawDept;
  }
  dept = dept.toLowerCase();
  const deptInfo = deptMap[dept];

  if (!deptInfo) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-red-600">Department Not Found</h1>
            <p className="mt-2 text-gray-600">The department &quot;{rawDept}&quot; is not recognized.</p>
          </div>
        </div>
      </div>
    );
  }

  const { findings, reviewedFindings, executiveSummary, schedule } = await loadAuditReviewData(dept);

  return (
    <AuditReviewDeptClient
      apiPath={deptInfo.apiPath}
      deptName={deptInfo.deptName}
      titleCode={deptInfo.titleCode}
      initialFindings={findings}
      initialReviewedFindings={reviewedFindings}
      initialExecutiveSummary={executiveSummary}
      initialSchedule={schedule}
    />
  );
}

