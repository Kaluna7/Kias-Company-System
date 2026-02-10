"use client";

import Link from "next/link";
import Image from "next/image";

export default function AuditReviewTemplatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="bg-[#141D38] rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-row justify-between items-center">
              <div className="flex items-center justify-center md:justify-start space-x-3">
                <Image src="/images/kias-logo.webp" width={100} height={100} alt="kias logo" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white">C.1 AUDIT REVIEW - TEMPLATE</h3>
                <p className="text-blue-100 mt-1">Management Dashboard</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex justify-end mb-4">
          <Link
            href="/Page/audit-review/"
            className="bg-white rounded-xl shadow px-4 py-2 border border-gray-200 hover:shadow-md transition text-sm font-semibold text-gray-800"
          >
            Back
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-800">Review Template</h2>
          <p className="mt-3 text-sm text-gray-700">
            Halaman ini untuk template Audit Review (mis. excel template / form / download).
            <br />
            Kalau kamu punya file template (xlsx) atau struktur field yang harus ada, kirim ya — nanti saya buatkan UI
            download / form input sesuai kebutuhan.
          </p>
        </div>
      </div>
    </div>
  );
}


