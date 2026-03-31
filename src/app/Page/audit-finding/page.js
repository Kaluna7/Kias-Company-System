// app/b2-audit/page.js
import Link from 'next/link';
import Image from 'next/image';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getInternalFetchBaseUrl } from '@/lib/getInternalFetchBaseUrl';
import {
  buildScheduleWindowsByDeptKey,
  formatScheduleRange,
} from "@/lib/scheduleCardHelpers";

// Map department name to deptKey for user assignment checking
function getDeptKeyFromDepartmentName(deptName) {
  const deptMap = {
    "FINANCE": "finance",
    "ACCOUNTING": "accounting",
    "HRD": "hrd",
    "G&A": "g&a",
    "STORE DESIGN PLANNER": "sdp",
    "TAX": "tax",
    "SECURITY L&P": "l&p",
    "MIS": "mis",
    "MERCHANDISE": "merch",
    "OPERATIONAL": "ops",
    "WAREHOUSE": "whs",
  };
  return deptMap[deptName] || null;
}

export default async function B2AuditFinding({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  // Get user session and assignments
  const session = await getServerSession(authOptions);
  const userName = session?.user?.name || "";
  const role = (session?.user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isReviewer = role === "reviewer";
  
  // Get user assignments for Audit Finding module
  // Reviewer needs assignment like regular user, but can only edit reviewer fields
  let allowedDepartments = [];
  if (!isAdmin && !isReviewer && userName) {
    try {
      const baseUrl = getInternalFetchBaseUrl();
      const res = await fetch(`${baseUrl}/api/schedule/user-assignments?userName=${encodeURIComponent(userName)}&module=audit-finding`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success) {
          allowedDepartments = data.allowedDepartments || [];
        }
      }
    } catch (err) {
      console.warn("Failed to load user assignments:", err.message);
    }
  }
  
  // Create Set of allowed department names for quick lookup
  // Match by department name (case-insensitive) and also by deptKey
  const allowedDeptNames = new Set(
    allowedDepartments.map(d => d.name.toUpperCase())
  );
  const allowedDeptKeys = new Set(
    allowedDepartments.map(d => d.key)
  );
  
  const isDepartmentEnabled = (deptName) => {
    // Admin can access all departments
    // Reviewer can access all departments (for viewing), but can only edit reviewer fields
    if (isAdmin || isReviewer) return true;
    // If no assignments, disable all departments
    if (allowedDepartments.length === 0) return false;
    // Check if department is in allowed list (by name or by deptKey)
    const deptKey = getDeptKeyFromDepartmentName(deptName);
    return allowedDeptNames.has(deptName.toUpperCase()) || (deptKey && allowedDeptKeys.has(deptKey));
  };

  // Base list: id, department, apiPath (for /api/audit-finding/{apiPath}/meta)
  const baseFindings = [
    { id: 'B2.1', department: 'FINANCE', apiPath: 'finance' },
    { id: 'B2.2', department: 'ACCOUNTING', apiPath: 'accounting' },
    { id: 'B2.3', department: 'HRD', apiPath: 'hrd' },
    { id: 'B2.4', department: 'G&A', apiPath: 'g&a' },
    { id: 'B2.5', department: 'STORE DESIGN PLANNER', apiPath: 'sdp' },
    { id: 'B2.6', department: 'TAX', apiPath: 'tax' },
    { id: 'B2.7', department: 'SECURITY L&P', apiPath: 'l&p' },
    { id: 'B2.8', department: 'MIS', apiPath: 'mis' },
    { id: 'B2.9', department: 'MERCHANDISE', apiPath: 'merch' },
    { id: 'B2.10', department: 'OPERATIONAL', apiPath: 'ops' },
    { id: 'B2.11', department: 'WAREHOUSE', apiPath: 'whs' },
  ];

  const internalBase = getInternalFetchBaseUrl();

  const [metaResults, scheduleByDeptKey] = await Promise.all([
    Promise.all(
      baseFindings.map(async (base) => {
        try {
          const url = new URL(`${internalBase}/api/audit-finding/${encodeURIComponent(base.apiPath)}/meta`);
          if (yearParam) {
            url.searchParams.set("year", String(yearParam));
          }
          const res = await fetch(url.toString(), { cache: 'no-store' });
          if (!res.ok) return { ...base, statusWP: 'Not Checked', process: '', finalStatus: '' };
          const json = await res.json().catch(() => null);
          const meta = json?.success ? json.data : null;
          const preparerStatus = (meta?.preparer_status || '').toUpperCase().trim();
          const finalStatus = (meta?.final_status || '').toUpperCase().trim();
          // Process: from preparer_status or final_status; show nothing (-) when neither is set
          const process = preparerStatus || finalStatus || '';
          // statusWP (Not Checked / Checked): from page meta — Checked when COMPLETED/APPROVED, else Not Checked
          const statusWP = (preparerStatus === 'COMPLETED' || preparerStatus === 'APPROVED' || finalStatus === 'COMPLETED' || finalStatus === 'APPROVED')
            ? 'Checked'
            : 'Not Checked';
          return { ...base, statusWP, process, finalStatus };
        } catch (_) {
          return { ...base, statusWP: 'Not Checked', process: '', finalStatus: '' };
        }
      })
    ),
    (async () => {
      try {
        const sr = await fetch(`${internalBase}/api/schedule/module?module=audit-finding`, { cache: "no-store" });
        const sj = await sr.json().catch(() => null);
        if (sr.ok && sj?.success && Array.isArray(sj.rows)) {
          return buildScheduleWindowsByDeptKey(sj.rows);
        }
      } catch (e) {
        console.warn("Failed to load audit-finding schedule dates:", e?.message);
      }
      return {};
    })(),
  ]);

  const auditFindings = metaResults;

  const yearQuery = yearParam ? `?year=${encodeURIComponent(yearParam)}` : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/Page/dashboard${yearQuery}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </Link>
        </div>
        {/* Header dengan Logo */}
        <header className="mb-8">
          <div className="bg-[#141D38] rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-row md:flex-row justify-between items-center">
              <div className="flex items-center justify-center md:justify-start space-x-3">
                <div>
                  <Image
                    src="/images/kias-logo.webp"
                    width={100}
                    height={100}
                    alt='kias logo'
                  />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white">B2 AUDIT FINDING</h3>
                <p className="text-blue-100 mt-1">Audit Management System</p>
              </div>
            </div>
          </div>
        </header>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Findings</p>
                <p className="text-2xl font-bold text-gray-800">{auditFindings.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-gray-800">{auditFindings.filter(item => item.process === 'IN PROGRESS').length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center">
              <div className="bg-yellow-100 p-3 rounded-lg mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Review</p>
                <p className="text-2xl font-bold text-gray-800">{auditFindings.filter(item => (item.finalStatus || '').toUpperCase() === 'PENDING REVIEW').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-800">{auditFindings.filter(item => (item.process || '').toUpperCase() === 'COMPLETED').length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Findings Grid */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Audit Findings by Department</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auditFindings.map((finding) => {
              // Map finding ID to department folder
              const deptMap = {
                'B2.1': 'finance',
                'B2.2': 'accounting',
                'B2.3': 'hrd',
                'B2.4': 'g&a',
                'B2.5': 'sdp',
                'B2.6': 'tax',
                'B2.7': 'l&p',
                'B2.8': 'mis',
                'B2.9': 'merch',
                'B2.10': 'ops',
                'B2.11': 'whs'
              };
              const deptPath = deptMap[finding.id] || finding.id.toLowerCase();
              const isEnabled = isDepartmentEnabled(finding.department);
              const isDisabled = !isEnabled;
              const win = scheduleByDeptKey[finding.apiPath];
              const scheduleRange = win ? formatScheduleRange(win.start, win.end) : "";

              return isDisabled ? (
                <div
                  key={finding.id}
                  className="bg-gray-100 rounded-xl shadow-sm p-5 border border-gray-200 opacity-60 cursor-not-allowed"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded mb-2 inline-block">
                        {finding.id}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-600">{finding.department}</h3>
                    </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                      {finding.finalStatus || "-"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                      {finding.process || "-"}
                    </span>
                  </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-600">Schedule</span>
                    <span className="block mt-0.5">{scheduleRange || "—"}</span>
                  </p>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-500">Status: Locked</span>
                      </div>
                      <div className="text-gray-400 flex items-center">
                        <span className="text-sm font-medium">Locked</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
              <Link 
                key={finding.id}
                href={`/Page/audit-finding/${deptPath}${yearQuery}`}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px] block"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded mb-2 inline-block">
                      {finding.id}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-800">{finding.department}</h3>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {finding.finalStatus || "-"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {finding.process || "-"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-slate-600">Schedule</span>
                  <span className="block mt-0.5">{scheduleRange || "—"}</span>
                </p>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-gray-500">Status: Active</span>
                    </div>
                    <div className="text-blue-600 flex items-center">
                      <span className="text-sm font-medium">Open</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
              );
            })}
            
            {/* Report Card - Added after all department cards */}
            <Link 
              href={`/Page/audit-finding/report${yearQuery}`}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px] block"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded mb-2 inline-block">
                    REPORT
                  </span>
                  <h3 className="text-lg font-semibold text-gray-800">Report</h3>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Published Data
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-2">
                <span className="font-semibold text-slate-600">Schedule</span>
                <span className="block mt-0.5">—</span>
              </p>
              
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs text-gray-500">Status: Active</span>
                  </div>
                  <div className="text-blue-600 flex items-center">
                    <span className="text-sm font-medium">Open</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}