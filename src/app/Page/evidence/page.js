// app/page.js
import Link from 'next/link';
import Image from 'next/image';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getInternalFetchBaseUrl } from '@/lib/getInternalFetchBaseUrl';
import {
  buildScheduleWindowsByUpperDeptName,
  formatScheduleRange,
} from "@/lib/scheduleCardHelpers";

// Map department name to deptKey for user assignment checking
function getDeptKeyFromDepartmentName(deptName) {
  const deptMap = {
    "FINANCE": "finance",
    "ACCOUNTING": "accounting",
    "HRD": "hrd",
    "G&A": "g&a",
    "DESIGN STORE PLANNER": "sdp",
    "TAX": "tax",
    "SECURITY L&P": "l&p",
    "MIS": "mis",
    "MERCHANDISE": "merch",
    "OPERATIONAL": "ops",
    "WAREHOUSE": "whs",
  };
  return deptMap[deptName] || null;
}

export default async function Evidence({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  let auditYear = new Date().getFullYear();
  if (yearParam != null && String(yearParam).trim() !== "") {
    const p = parseInt(String(yearParam), 10);
    if (Number.isFinite(p)) auditYear = p;
  }
  const yearQuery = `?year=${encodeURIComponent(String(auditYear))}`;

  // Get user session and assignments
  const session = await getServerSession(authOptions);
  const userName = session?.user?.name || "";
  const role = (session?.user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isReviewer = role === "reviewer";
  
  // Get user assignments for Evidence module
  // Reviewer needs assignment like regular user, but can only edit reviewer fields
  let allowedDepartments = [];
  if (!isAdmin && !isReviewer && userName) {
    try {
      const baseUrl = getInternalFetchBaseUrl();
      const res = await fetch(
        `${baseUrl}/api/schedule/user-assignments?userName=${encodeURIComponent(userName)}&module=evidence&year=${encodeURIComponent(String(auditYear))}`,
        {
        cache: "no-store",
        }
      );
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

  let scheduleByDept = {};
  try {
    const baseUrl = getInternalFetchBaseUrl();
    const sr = await fetch(
      `${baseUrl}/api/schedule/module?module=evidence&year=${encodeURIComponent(String(auditYear))}`,
      { cache: "no-store" }
    );
    const sj = await sr.json().catch(() => null);
    if (sr.ok && sj?.success && Array.isArray(sj.rows)) {
      scheduleByDept = buildScheduleWindowsByUpperDeptName(sj.rows);
    }
  } catch (e) {
    console.warn("Failed to load evidence schedule dates:", e?.message);
  }

  const hasEvidenceScheduleForDept = (deptName) => {
    const win = scheduleByDept[deptName];
    return !!(win?.start && win?.end);
  };

  const isDepartmentEnabled = (deptName) => {
    if (!hasEvidenceScheduleForDept(deptName)) return false;
    if (isAdmin || isReviewer) return true;
    if (allowedDepartments.length === 0) return false;
    const deptKey = getDeptKeyFromDepartmentName(deptName);
    return allowedDeptNames.has(deptName.toUpperCase()) || (deptKey && allowedDeptKeys.has(deptKey));
  };

  const evidences = [
    { id: 'E1.1', department: 'FINANCE' },
    { id: 'E1.2', department: 'ACCOUNTING' },
    { id: 'E1.3', department: 'HRD' },
    { id: 'E1.4', department: 'G&A' },
    { id: 'E1.5', department: 'DESIGN STORE PLANNER' },
    { id: 'E1.6', department: 'TAX' },
    { id: 'E1.7', department: 'SECURITY L&P' },
    { id: 'E1.8', department: 'MIS' },
    { id: 'E1.9', department: 'MERCHANDISE' },
    { id: 'E1.10', department: 'OPERATIONAL' },
    { id: 'E1.11', department: 'WAREHOUSE' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 sm:p-4 md:p-6">
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
          <div className="bg-[#141D38] rounded-xl shadow-lg p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                <div className="flex items-center justify-center sm:justify-start space-x-3">
                  <div>
                    <Image
                    src="/images/kias-logo.webp"
                    width={100}
                    height={100}
                    alt='kias logo'
                    />
                  </div>
                </div>
                <div className="text-center sm:text-right">
                    <h3 className="text-xl sm:text-2xl font-bold text-white">E.1 EVIDENCE</h3>
                    <p className="text-blue-100 mt-1">Management Dashboard</p>
                </div>
            </div>
          </div>
        </header>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Evidence</p>
                <p className="text-2xl font-bold text-gray-800">{evidences.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-gray-800">0</p>
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
                <p className="text-2xl font-bold text-gray-800">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Evidence Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Evidence by Department</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {evidences.map((evidence) => {
              // Map evidence ID to department folder
              const deptMap = {
                'E1.1': 'finance',
                'E1.2': 'accounting',
                'E1.3': 'hrd',
                'E1.4': 'g&a',
                'E1.5': 'sdp',
                'E1.6': 'tax',
                'E1.7': 'l&p',
                'E1.8': 'mis',
                'E1.9': 'merch',
                'E1.10': 'ops',
                'E1.11': 'whs'
              };
              const deptPath = deptMap[evidence.id] || evidence.id.toLowerCase();
              const isEnabled = isDepartmentEnabled(evidence.department);
              const isDisabled = !isEnabled;
              const win = scheduleByDept[evidence.department];
              const scheduleRange = win ? formatScheduleRange(win.start, win.end) : "";

              return isDisabled ? (
                <div
                  key={evidence.id}
                  className="bg-gray-100 rounded-xl shadow-sm p-5 border border-gray-200 opacity-60 cursor-not-allowed"
                >
                  <div className="flex justify-between items-center gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-600 break-words">{evidence.department}</h3>
                    <div className="text-gray-400 flex items-center">
                      <span className="text-sm font-medium">Locked</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    <span className="font-semibold text-slate-600">Schedule</span>
                    <span className="block mt-0.5">{scheduleRange || "—"}</span>
                  </p>
                </div>
              ) : (
              <Link 
                key={evidence.id}
                href={`/Page/evidence/${deptPath}${yearQuery}`}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px]"
              >
                <div className="flex justify-between items-center gap-3">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 break-words">{evidence.department}</h3>
                  <div className="text-blue-600 flex items-center">
                    <span className="text-sm font-medium">Open</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  <span className="font-semibold text-slate-600">Schedule</span>
                  <span className="block mt-0.5">{scheduleRange || "—"}</span>
                </p>
              </Link>
              );
            })}
            
            {/* Report Card */}
            <Link 
              href={`/Page/evidence/report${yearQuery}`}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px]"
            >
              <div className="flex justify-between items-center gap-3">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800">REPORT</h3>
                <div className="text-blue-600 flex items-center">
                  <span className="text-sm font-medium">Open</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                <span className="font-semibold text-slate-600">Schedule</span>
                <span className="block mt-0.5">—</span>
              </p>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

