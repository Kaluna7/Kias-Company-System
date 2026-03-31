// app/page.js
import Link from "next/link";
import Image from "next/image";
import { PrismaClient } from "@/generated/prisma";
import { Suspense } from "react";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getInternalFetchBaseUrl } from '@/lib/getInternalFetchBaseUrl';
import {
  buildScheduleWindowsByUpperDeptName,
  formatScheduleRange,
} from "@/lib/scheduleCardHelpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Reuse a single Prisma instance in dev for better performance
const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

function WorksheetContentSkeleton() {
  return (
    <>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center">
              <div className="bg-slate-100 p-3 rounded-lg mr-4 w-12 h-12 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse mb-2" />
                <div className="h-7 w-12 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Worksheets Grid */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Worksheets by Department</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-md p-5 border border-gray-200"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
                <div className="h-5 w-24 bg-slate-100 rounded-full animate-pulse" />
              </div>
              <div className="flex justify-between items-center">
                <div className="h-5 w-28 bg-slate-100 rounded-full animate-pulse" />
                <div className="h-4 w-14 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

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

function worksheetAvailabilityStatus(row) {
  if (!row) return "Not Available";
  const hasFile = !!(row.file_path && String(row.file_path).trim());
  const sw = String(row.status_worksheet || "").trim().toUpperCase();
  if (hasFile || sw === "AVAILABLE") return "Available";
  return "Not Available";
}

async function WorksheetContent({ yearParam }) {
  // Get user session and assignments
  const session = await getServerSession(authOptions);
  const userName = session?.user?.name || "";
  const role = (session?.user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isReviewer = role === "reviewer";
  
  // Get user assignments for Worksheet module
  // Reviewer needs assignment like regular user, but can only edit reviewer fields
  let allowedDepartments = [];
  if (!isAdmin && !isReviewer && userName) {
    try {
      const baseUrl = getInternalFetchBaseUrl();
      const res = await fetch(`${baseUrl}/api/schedule/user-assignments?userName=${encodeURIComponent(userName)}&module=worksheet`, {
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

  const baseWorksheets = [
    { id: "B1.1", department: "FINANCE" },
    { id: "B1.2", department: "ACCOUNTING" },
    { id: "B1.3", department: "HRD" },
    { id: "B1.4", department: "G&A" },
    { id: "B1.5", department: "DESIGN STORE PLANNER" },
    { id: "B1.6", department: "TAX" },
    { id: "B1.7", department: "SECURITY L&P" },
    { id: "B1.8", department: "MIS" },
    { id: "B1.9", department: "MERCHANDISE" },
    { id: "B1.10", department: "OPERATIONAL" },
    { id: "B1.11", department: "WAREHOUSE" },
  ];
  
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

  // Ambil data terakhir per department dari database (order by created_at desc, ambil baris pertama per department = terbaru)
  const year = yearParam ? parseInt(yearParam, 10) : null;
  const departments = baseWorksheets.map((w) => w.department);

  let latestByDept = {};
  try {
    const where = { department: { in: departments } };
    if (!Number.isNaN(year) && year) {
      const from = new Date(year, 0, 1);
      const to = new Date(year + 1, 0, 1);
      // Filter berdasarkan created_at dalam tahun tersebut
      where.created_at = { gte: from, lt: to };
    }

    const rows = await prisma.worksheet_finance.findMany({
      where,
      orderBy: { created_at: "desc" },
      select: {
        department: true,
        status_wp: true,
        status_worksheet: true,
        file_path: true,
        created_at: true,
      },
    });
    // Baris sudah urut created_at desc → pertama kali ketemu department = row terbaru
    for (const row of rows) {
      if (!row.department) continue;
      if (!latestByDept[row.department]) {
        latestByDept[row.department] = row;
      }
    }
  } catch (e) {
    console.error("Failed to load worksheet summaries:", e);
  }

  let scheduleWindowByDept = {};
  try {
    const baseUrl = getInternalFetchBaseUrl();
    const sr = await fetch(`${baseUrl}/api/schedule/module?module=worksheet`, { cache: "no-store" });
    const sj = await sr.json().catch(() => null);
    if (sr.ok && sj?.success && Array.isArray(sj.rows)) {
      scheduleWindowByDept = buildScheduleWindowsByUpperDeptName(sj.rows);
    }
  } catch (e) {
    console.warn("Failed to load worksheet schedule windows:", e?.message);
  }

  const worksheets = baseWorksheets.map((base) => {
    const row = latestByDept[base.department];
    const status = worksheetAvailabilityStatus(row);
    const statusWP = row?.status_wp ?? "";
    const win = scheduleWindowByDept[base.department];
    const scheduleRange = win ? formatScheduleRange(win.start, win.end) : "";
    return {
      ...base,
      status,
      statusWP,
      scheduleRange,
    };
  });

  const yearQuery = yearParam ? `?year=${encodeURIComponent(yearParam)}` : "";

  return (
    <>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Worksheets</p>
                <p className="text-2xl font-bold text-gray-800">{worksheets.length}</p>
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
                <p className="text-sm text-gray-500">Available</p>
                <p className="text-2xl font-bold text-gray-800">{worksheets.filter(item => item.status === 'Available').length}</p>
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
                <p className="text-2xl font-bold text-gray-800">{worksheets.filter(item => !item.statusWP || item.statusWP === 'Not Checked').length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Worksheets Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Worksheets by Department</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {worksheets.map((worksheet, index) => {
              // Map worksheet ID to department folder
              const deptMap = {
                "B1.1": "finance",
                "B1.2": "accounting",
                "B1.3": "hrd",
                "B1.4": "g&a",
                "B1.5": "sdp",
                "B1.6": "tax",
                "B1.7": "l&p",
                "B1.8": "mis",
                "B1.9": "merch",
                "B1.10": "ops",
                "B1.11": "whs",
              };
              const deptPath = deptMap[worksheet.id] || worksheet.id.toLowerCase();
              const isEnabled = isDepartmentEnabled(worksheet.department);
              const isDisabled = !isEnabled;
              
              return isDisabled ? (
                <div
                  key={worksheet.id}
                  className="bg-gray-100 rounded-xl shadow-sm p-5 border border-gray-200 opacity-60 cursor-not-allowed"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-600">{worksheet.department}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-600">Schedule</span>
                    <span className="block mt-0.5">{worksheet.scheduleRange || "—"}</span>
                  </p>
                  <div className="flex justify-between items-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        worksheet.status === "Available"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {worksheet.status || "—"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                      {worksheet.statusWP || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-gray-400 flex items-center">
                      <span className="text-sm font-medium">Locked</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : (
              <Link 
                key={worksheet.id}
                href={`/Page/worksheet/${deptPath}${yearQuery}`}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px]"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">{worksheet.department}</h3>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-slate-600">Schedule</span>
                  <span className="block mt-0.5">{worksheet.scheduleRange || "—"}</span>
                </p>
                <div className="flex justify-between items-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      worksheet.status === "Available" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {worksheet.status || "—"}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {worksheet.statusWP || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="text-blue-600 flex items-center">
                    <span className="text-sm font-medium">Open</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </Link>
              );
            })}
            {/* Report Card */}
            <Link
              href={`/Page/worksheet/report${yearQuery}`}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px]"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-800">REPORT</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Report
                </span>
              </div>
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-500">All Departments</span>
                <span className="text-sm font-medium text-gray-700">-</span>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                <span className="font-semibold text-slate-600">Schedule</span>
                <span className="block mt-0.5">—</span>
              </p>
              
              <div className="flex justify-between items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Available
                </span>
                <div className="text-blue-600 flex items-center">
                  <span className="text-sm font-medium">Open</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </div>
    </>
  );
}

export default async function Worksheet({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
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
                    alt="kias logo"
                    priority
                    sizes="(max-width: 768px) 64px, 100px"
                  />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white">B.1 WORKSHEET</h3>
                <p className="text-blue-100 mt-1">Management Dashboard</p>
              </div>
            </div>
          </div>
        </header>

        <Suspense fallback={<WorksheetContentSkeleton />}>
          <WorksheetContent yearParam={yearParam} />
        </Suspense>
      </div>
    </div>
  );
}