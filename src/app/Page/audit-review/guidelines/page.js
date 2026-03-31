"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

function AuditReviewGuidelinesPageContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const yearQuery = yearParam ? `?year=${encodeURIComponent(yearParam)}` : "";
  const objectives = [
    { number: 1, title: "Risk Management", description: "Identify and assess risks." },
    { number: 2, title: "Control Evaluation", description: "Assess internal controls' effectiveness." },
    { number: 3, title: "Compliance", description: "Verify adherence to laws and policies." },
    { number: 4, title: "Operational Efficiency", description: "Evaluate efficiency and effectiveness of operations." },
    { number: 5, title: "Financial Accuracy", description: "Ensure reliability of financial reporting." },
    { number: 6, title: "Governance Support", description: "Assist in governance processes." },
    { number: 7, title: "Fraud Prevention", description: "Identify and mitigate fraud risks." },
    { number: 8, title: "Strategic Alignment", description: "Ensure alignment of strategies with operations." },
    { number: 9, title: "Follow-Up", description: "Monitor implementation of previous audit recommendations." },
    { number: 10, title: "Reporting", description: "Communicate findings effectively." },
    { number: 11, title: "Continuous Improvement", description: "Promote ongoing evaluation and improvement." },
    { number: 12, title: "Training", description: "Support staff training on controls and compliance." }
  ];

  const areasCovered = {
    "Financial Processes": ["Revenue recognition", "Expense management"],
    "Operational Processes": ["Supply chain management", "Inventory control"],
    "IT Systems": ["Data security", "System access controls"],
    "Compliance": ["Regulatory adherence", "Internal policies and procedures"]
  };

  const methodologies = [
    {
      title: "Document Review",
      description: "Examination of policies, procedures, and financial records."
    },
    {
      title: "Interviews",
      description: "Discussions with key personnel to understand processes."
    },
    {
      title: "Observations",
      description: "Direct observation of operations to assess efficiency."
    },
    {
      title: "Testing",
      description: "Sampling of transactions to ensure accuracy and compliance."
    }
  ];

  const scopeLimitations = [
    {
      title: "Lack of Access to Documents",
      description: "The research may be limited due to the unavailability of certain historical records that are essential."
    },
    {
      title: "Restricted Areas",
      description: "Field studies may be constrained by restricted access to specific sites, such as private properties."
    }
  ];

  const timeConstraints = [
    {
      title: "Short Timeline",
      description: "The project must be completed within a three-month period, which may limit the depth of research and analysis."
    },
    {
      title: "Deadline Pressures",
      description: "Limited time for data collection could result in a smaller sample size and less comprehensive results."
    }
  ];

  const resourceConstraints = [
    {
      title: "Budget Limitations",
      description: "A limited budget may restrict the number of participants in a study or the quality of materials used."
    },
    {
      title: "Staffing Constraints",
      description: "Insufficient personnel might affect the ability to conduct thorough data collection or analysis."
    }
  ];

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
                <h3 className="text-2xl font-bold text-white">C.1 AUDIT REVIEW - GUIDELINES</h3>
                <p className="text-blue-100 mt-1">Internal Audit Review Executive Summary</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex justify-end mb-4">
          <Link
            href={`/Page/audit-review${yearQuery}`}
            className="bg-white rounded-xl shadow px-4 py-2 border border-gray-200 hover:shadow-md transition text-sm font-semibold text-gray-800 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Title */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h1 className="text-3xl font-bold text-gray-800 text-center">Internal Audit Review Executive Summary</h1>
          </div>

          {/* Section: Objective of the Audit */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Objective of the Audit</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {objectives.map((obj) => (
                <div
                  key={obj.number}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {obj.number}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 mb-1">{obj.title}</h3>
                      <p className="text-sm text-gray-600">{obj.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 1: Scope of the Audit */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Scope of the Audit</h2>
            </div>

            <div className="space-y-6">
              {/* 1.1 Areas Covered */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-5 border border-emerald-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-emerald-600 text-white rounded px-2 py-1 text-sm">1.1</span>
                  Areas Covered
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(areasCovered).map(([area, items]) => (
                    <div key={area} className="bg-white rounded-lg p-4 border border-emerald-200 shadow-sm">
                      <h4 className="font-semibold text-gray-800 mb-2">{area}:</h4>
                      <ul className="space-y-1">
                        {items.map((item, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-emerald-600 mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* 1.2 Methodology */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-5 border border-purple-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-purple-600 text-white rounded px-2 py-1 text-sm">1.2</span>
                  Methodology
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {methodologies.map((method, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                      <h4 className="font-semibold text-gray-800 mb-2">{method.title}:</h4>
                      <p className="text-sm text-gray-600">{method.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 1.3 Timeframe */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-5 border border-amber-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-amber-600 text-white rounded px-2 py-1 text-sm">1.3</span>
                  Timeframe
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-2">Audit Period:</h4>
                    <p className="text-sm text-gray-600 italic">
                      [Specify the period covered by the audit, e.g., January 2024 - December 2024]
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-2">Fieldwork Dates:</h4>
                    <p className="text-sm text-gray-600 italic">
                      [Specify the dates when the audit was conducted]
                    </p>
                  </div>
                </div>
              </div>

              {/* 1.4 Limitations */}
              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg p-5 border border-red-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="bg-red-600 text-white rounded px-2 py-1 text-sm">1.4</span>
                  Limitations
                </h3>

                {/* Scope Limitations */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-3 text-base">Scope Limitations:</h4>
                  <div className="space-y-3">
                    {scopeLimitations.map((limitation, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 border border-red-200 shadow-sm">
                        <h5 className="font-semibold text-gray-800 mb-1">{limitation.title}:</h5>
                        <p className="text-sm text-gray-600">{limitation.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time Constraints */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-3 text-base">Time Constraints:</h4>
                  <div className="space-y-3">
                    {timeConstraints.map((constraint, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 border border-red-200 shadow-sm">
                        <h5 className="font-semibold text-gray-800 mb-1">{constraint.title}:</h5>
                        <p className="text-sm text-gray-600">{constraint.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resource Availability */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3 text-base">Resource Availability:</h4>
                  <div className="space-y-3">
                    {resourceConstraints.map((constraint, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 border border-red-200 shadow-sm">
                        <h5 className="font-semibold text-gray-800 mb-1">{constraint.title}:</h5>
                        <p className="text-sm text-gray-600">{constraint.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Key Findings */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Key Findings</h2>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-5 border border-yellow-100">
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-yellow-200 shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-2">Finding 1: Description of the issue.</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold text-gray-700">Impact:</span>
                      <span className="text-sm text-gray-600 ml-2 italic">[Brief description of potential impact]</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Recommendation:</span>
                      <span className="text-sm text-gray-600 ml-2 italic">[Suggested action]</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Overall Assessment */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Overall Assessment</h2>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-5 border border-indigo-100">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 mt-1">•</span>
                  <span>Summary of the effectiveness of internal controls.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 mt-1">•</span>
                  <span>General compliance status.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600 mt-1">•</span>
                  <span>Areas of strength and weaknesses identified.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 4: Follow Up */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">4</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Follow Up</h2>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-5 border border-teal-100">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-1">•</span>
                  <span>Action plan for addressing findings.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-1">•</span>
                  <span>Timeline for implementation.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-1">•</span>
                  <span>Follow-up audit dates.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 5: Conclusion */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-slate-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">5</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Conclusion</h2>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-5 border border-gray-200">
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-gray-600 mt-1">•</span>
                  <span>A brief summary of the overall audit results.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-600 mt-1">•</span>
                  <span>Importance of addressing the identified issues.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditReviewGuidelinesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <AuditReviewGuidelinesPageContent />
    </Suspense>
  );
}
