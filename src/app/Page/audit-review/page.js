"use client";

import Link from "next/link";
import Image from "next/image";

export default function AuditReviewHomePage() {
  const auditReviewDepts = [
    { id: "C1.1", label: "FINANCE", href: "/Page/audit-review/finance" },
    { id: "C1.2", label: "ACCOUNTING", href: "/Page/audit-review/accounting" },
    { id: "C1.3", label: "HRD", href: "/Page/audit-review/hrd" },
    { id: "C1.4", label: "G&A", href: "/Page/audit-review/g&a" },
    { id: "C1.5", label: "STORE DESIGN PLANNER", href: "/Page/audit-review/sdp" },
    { id: "C1.6", label: "TAX", href: "/Page/audit-review/tax" },
    { id: "C1.7", label: "SECURITY L&P", href: "/Page/audit-review/l&p" },
    { id: "C1.8", label: "MIS", href: "/Page/audit-review/mis" },
    { id: "C1.9", label: "MERCHANDISE", href: "/Page/audit-review/merch" },
    { id: "C1.10", label: "OPERATIONAL", href: "/Page/audit-review/ops" },
    { id: "C1.11", label: "WAREHOUSE", href: "/Page/audit-review/whs" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header (mengikuti Evidence) */}
        <header className="mb-8">
          <div className="bg-[#141D38] rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-row justify-between items-center">
              <div className="flex items-center justify-center md:justify-start space-x-3">
                <Image src="/images/kias-logo.webp" width={100} height={100} alt="kias logo" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white">C.1 AUDIT REVIEW</h3>
                <p className="text-blue-100 mt-1">Management Dashboard</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
          {/* Left feature panel */}
          <div className="rounded-3xl bg-[#F4D50B] p-4 shadow-md border border-yellow-300/50">
            <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 p-4 shadow-inner border border-orange-200">
              <div className="text-white font-extrabold leading-none">
                <div className="text-3xl drop-shadow-sm">AUDIT</div>
                <div className="text-3xl drop-shadow-sm mt-1">Review</div>
              </div>
            </div>

            <div className="mt-8 text-[#141D38]">
              <div className="text-2xl font-black">Homepage</div>
              <p className="mt-3 text-sm font-semibold text-[#141D38]/80">
                Akses cepat untuk <span className="font-black">Review Guidelines</span>,{" "}
                <span className="font-black">Review Template</span>, dan mapping departemen.
              </p>

              <div className="mt-4 grid gap-3">
                <Link
                  href="/Page/audit-review/guidelines/"
                  className="rounded-2xl bg-white/90 border border-white shadow-sm hover:shadow-md transition px-4 py-3 text-center font-extrabold text-[#141D38] text-sm"
                >
                  REVIEW
                  <br />
                  GUIDELINES
                </Link>

                <Link
                  href="/Page/audit-review/template/"
                  className="rounded-2xl bg-white/90 border border-white shadow-sm hover:shadow-md transition px-4 py-3 text-center font-extrabold text-[#141D38] text-sm"
                >
                  REVIEW
                  <br />
                  TEMPLATE
                </Link>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-col gap-6">
            <div className="rounded-xl bg-white shadow-md border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-800">Welcome to the Audit Review!</h2>
              <p className="mt-4 text-sm text-gray-700">
                Hi Team,
                <br />
                We&apos;re excited to kick off our audit review and wanted to take a moment to share what&apos;s coming
                up!
              </p>
            </div>

            <div className="rounded-xl bg-white shadow-md border border-gray-200 p-6">
              <div className="text-sm font-bold text-gray-800 mb-4">AUDIT REVIEW MAP</div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {auditReviewDepts.map((dept) => (
                  <Link
                    key={dept.id}
                    href={dept.href}
                    className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px]"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded mb-2 inline-block">
                          {dept.id}
                        </span>
                        <h3 className="text-lg font-semibold text-gray-800">{dept.label}</h3>
                      </div>
                      <div className="text-blue-600 flex items-center">
                        <span className="text-sm font-medium">Open</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


