import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { buttonSopReview } from "@/app/data/sopReviewConfig";

// Map department name to API endpoint
function getDepartmentApiPath(name) {
  const deptMap = {
    "Finnance": "finance",
    "Finance": "finance",
    "Accounting": "accounting",
    "HRD": "hrd",
    "General Affair": "g&a",
    "Store D & P": "sdp",
    "Tax": "tax",
    "L & P": "l&p",
    "MIS": "mis",
    "Merchandise": "merch",
    "Operational": "ops",
    "Warehouse": "whs",
  };
  return deptMap[name] || null;
}

// Server-side: one batch request for all SOP statuses (fast)
async function loadSopStatuses() {
  const statusMap = {};
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  try {
    const res = await fetch(`${baseUrl}/api/SopReview/status`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    const statuses = res.ok && data?.success ? data.statuses || {} : {};

    for (const item of buttonSopReview) {
      if (item.name === "Report") continue;
      const apiPath = getDepartmentApiPath(item.name);
      statusMap[item.name] = apiPath ? (statuses[apiPath] || "Not Available") : "Not Available";
    }
  } catch (err) {
    console.warn("Failed to load SOP statuses:", err?.message);
    for (const item of buttonSopReview) {
      if (item.name !== "Report") statusMap[item.name] = "Not Available";
    }
  }
  return statusMap;
}

function SopReviewGridSkeleton() {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">SOP Review by Department</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buttonSopReview.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-md p-5 border border-slate-200"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-3">
                {item.logo && item.logo !== "/" && (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center p-1.5 shadow-sm">
                    <div className="w-6 h-6 rounded bg-slate-200 animate-pulse" />
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
              </div>
            </div>

            {item.name !== "Report" && (
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">SOP Status:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                    Loading...
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end items-center mt-4">
              <div className="text-blue-600 flex items-center">
                <span className="text-sm font-semibold">Open</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function SopReviewGrid({ yearParam }) {
  const sopStatuses = await loadSopStatuses();
  
  // Get user session and assignments
  const session = await getServerSession(authOptions);
  const userName = (session?.user?.name || "").trim();
  const role = (session?.user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isReviewer = role === "reviewer";
  
  console.log(`[SOP Review] Session check:`, {
    userName,
    isAdmin,
    isReviewer,
    sessionUser: session?.user,
  });
  
  // Get user assignments for SOP Review module
  // Reviewer needs assignment like regular user, but can only edit reviewer fields
  let allowedDepartments = [];
  if (!isAdmin && userName) {
    try {
      const headersList = await headers();
      const host = headersList.get('host') || 'localhost:3000';
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const baseUrl = `${protocol}://${host}`;
      
      const apiUrl = `${baseUrl}/api/schedule/user-assignments?userName=${encodeURIComponent(userName)}&module=sop-review`;
      console.log(`[SOP Review] Fetching assignments from: ${apiUrl}`);
      
      const res = await fetch(apiUrl, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success) {
          allowedDepartments = data.allowedDepartments || [];
          console.log(`[SOP Review] API returned ${allowedDepartments.length} assignments`);
        } else {
          console.warn(`[SOP Review] API returned success=false:`, data);
        }
      } else {
        console.warn(`[SOP Review] API request failed: HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn("Failed to load user assignments:", err.message);
    }
  } else {
    console.log(`[SOP Review] Skipping assignment fetch: isAdmin=${isAdmin}, userName="${userName}"`);
  }
  
  // Normalize department name: remove "Sec." prefix and handle typos
  const normalizeDeptName = (name) => {
    if (!name) return "";
    let normalized = String(name).toLowerCase().trim();
    // Remove "Sec." prefix if present
    normalized = normalized.replace(/^sec\.\s*/i, "");
    // Handle "Finance" vs "Finnance" typo
    if (normalized === "finance" || normalized === "finnance") {
      return ["finance", "finnance"];
    }
    return normalized;
  };

  // Create Set of allowed department names for quick lookup
  // Handle both "Finance" and "Finnance" (typo in config)
  const allowedDeptNames = new Set(
    allowedDepartments.map(d => {
      const normalized = normalizeDeptName(d.name);
      return Array.isArray(normalized) ? normalized : [normalized];
    }).flat()
  );

  // Debug logging
  console.log(`[SOP Review] User: ${userName}, isAdmin: ${isAdmin}`);
  console.log(`[SOP Review] Allowed departments from API:`, allowedDepartments);
  console.log(`[SOP Review] Allowed dept names Set:`, Array.from(allowedDeptNames));

  const getStatusBadge = (status) => {
    const statusUpper = (status || "").toUpperCase();
    if (statusUpper === "AVAILABLE") {
      return "bg-green-100 text-green-800 border border-green-200";
    } else if (statusUpper === "NOT AVAILABLE") {
      return "bg-gray-100 text-gray-800 border border-gray-200";
    } else {
      return "bg-yellow-100 text-yellow-800 border border-yellow-200";
    }
  };
  
  const isDepartmentEnabled = (deptName) => {
    // Admin can access all departments
    // Reviewer can access all departments (for viewing), but can only edit reviewer fields
    if (isAdmin || isReviewer) return true;
    // Report is always accessible
    if (deptName === "Report") return true;
    // If no assignments, disable all departments
    if (allowedDepartments.length === 0) {
      console.log(`[SOP Review] Department "${deptName}" disabled: no assignments`);
      return false;
    }
    // Normalize department name for matching
    const normalized = normalizeDeptName(deptName);
    const normalizedList = Array.isArray(normalized) ? normalized : [normalized];
    
    // Check if any normalized variation is in allowed list
    const enabled = normalizedList.some(n => allowedDeptNames.has(n));
    console.log(`[SOP Review] Department "${deptName}" (normalized: ${normalizedList.join("/")}): ${enabled ? "ENABLED" : "DISABLED"}`);
    return enabled;
  };

  const yearQuery = yearParam ? `?year=${encodeURIComponent(yearParam)}` : "";

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">SOP Review by Department</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buttonSopReview.map((item, index) => {
          const isEnabled = item.name === "Report" || isDepartmentEnabled(item.name);
          const isDisabled = !isEnabled;
          
          return isDisabled ? (
            <div
              key={index}
              className="bg-gray-100 rounded-xl shadow-sm p-5 border border-gray-200 opacity-60 cursor-not-allowed"
            >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-3">
                {item.logo && item.logo !== "/" && (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center p-1.5 shadow-sm">
                    <Image
                      src={item.logo}
                      width={40}
                      height={40}
                      alt={item.name}
                      className="object-contain"
                      sizes="40px"
                    />
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
              </div>
            </div>

            {/* SOP Status - hanya untuk yang bukan Report */}
            {item.name !== "Report" && (
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">SOP Status:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(sopStatuses[item.name])}`}>
                    {sopStatuses[item.name] || "Not Available"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end items-center mt-4">
              <div className="text-gray-400 flex items-center">
                <span className="text-sm font-semibold">Locked</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>
          ) : (
          <Link
            key={index}
            href={`${item.href}${yearQuery}`}
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-5 border border-slate-200 hover:border-blue-400 hover:translate-y-[-4px] group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-3">
                {item.logo && item.logo !== "/" && (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center p-1.5 shadow-sm">
                    <Image
                      src={item.logo}
                      width={40}
                      height={40}
                      alt={item.name}
                      className="object-contain"
                      sizes="40px"
                    />
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
              </div>
            </div>

            {/* SOP Status - hanya untuk yang bukan Report */}
            {item.name !== "Report" && (
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">SOP Status:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(sopStatuses[item.name])}`}>
                    {sopStatuses[item.name] || "Not Available"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end items-center mt-4">
              <div className="text-blue-600 flex items-center group-hover:text-blue-700 transition-colors">
                <span className="text-sm font-semibold">Open</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function SopReview({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header dengan Logo */}
        <header className="mb-8">
          <div className="bg-gradient-to-r from-[#141D38] to-[#1a2747] rounded-2xl shadow-xl p-6 mb-6 border border-slate-700/50">
            <div className="flex flex-row md:flex-row justify-between items-center">
              <div className="flex items-center justify-center md:justify-start space-x-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2">
                  <Image
                    src="/images/kias-logo.webp"
                    width={100}
                    height={100}
                    alt='kias logo'
                    className="drop-shadow-lg"
                    priority
                    sizes="(max-width: 768px) 64px, 100px"
                  />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-3xl font-bold text-white" style={{ fontFamily: "system-ui, sans-serif", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>SOP REVIEW</h3>
                <p className="text-blue-200 mt-1 font-medium">Management Dashboard</p>
              </div>
            </div>
          </div>
        </header>

        {/* SOP Review Grid (streamed) */}
        <Suspense fallback={<SopReviewGridSkeleton />}>
          <SopReviewGrid yearParam={yearParam} />
        </Suspense>

      </div>
    </div>
  );
}

// [#e6f7fb]
