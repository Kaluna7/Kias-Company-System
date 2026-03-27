"use client";

import { useState } from "react";
import Image from "next/image";

export default function GuidelinesPage() {
  const [openModal, setOpenModal] = useState(null);

  const auditProcedures = [
    {
      title: "Audit Planning",
      descEn: "Developing an audit plan that includes objectives, scope, and methods.",
      descId: "Menyusun rencana audit yang mencakup tujuan, ruang lingkup, dan metode."
    },
    {
      title: "Evidence Gathering",
      descEn: "Collecting relevant evidence through interviews, observations, and documentation.",
      descId: "Mengumpulkan bukti yang relevan melalui wawancara, observasi, dan dokumentasi."
    },
    {
      title: "Risk Analysis",
      descEn: "Identifying and analyzing risks that may affect financial statements.",
      descId: "Mengidentifikasi dan menganalisis risiko yang dapat mempengaruhi laporan keuangan."
    },
    {
      title: "Internal Control Testing",
      descEn: "Examining the effectiveness of the internal controls implemented by the entity.",
      descId: "Memeriksa efektivitas pengendalian internal yang diterapkan oleh entitas."
    },
    {
      title: "Transaction Verification",
      descEn: "Verifying the accuracy and completeness of financial transactions.",
      descId: "Memverifikasi keakuratan dan kelengkapan transaksi keuangan."
    },
    {
      title: "Compliance Evaluation",
      descEn: "Assessing the entity's compliance with applicable laws and regulations.",
      descId: "Menilai kepatuhan entitas terhadap peraturan dan kebijakan yang berlaku."
    },
    {
      title: "Audit Reporting",
      descEn: "Preparing an audit report that includes findings and recommendations.",
      descId: "Menyusun laporan hasil audit yang mencakup temuan dan rekomendasi."
    },
    {
      title: "Follow-Up",
      descEn: "Monitoring and following up on recommendations provided in the audit report.",
      descId: "Memantau dan menindaklanjuti rekomendasi yang telah diberikan dalam laporan audit."
    },
    {
      title: "Recommendations",
      descEn: "Suggestions made based on audit findings to improve processes or controls.",
      descId: "Saran yang diberikan berdasarkan temuan audit untuk meningkatkan proses atau pengendalian."
    }
  ];

  const applicationSections = [
    {
      title: "SOP Review",
      descEn: "Evaluating and updating Standard Operating Procedures (SOPs) to ensure relevance and compliance.",
      descId: "Mengevaluasi dan memperbarui Prosedur Operasi Standar (SOP) untuk memastikan relevansi dan kepatuhan."
    },
    {
      title: "Risk Assessment",
      descEn: "Identifying and analyzing potential risks that could impact organizational objectives.",
      descId: "Mengidentifikasi dan menganalisis risiko potensial yang dapat mempengaruhi tujuan organisasi."
    },
    {
      title: "Audit Program",
      descEn: "Developing a detailed plan outlining the audit objectives, scope, and methodology.",
      descId: "Menyusun rencana rinci yang menguraikan tujuan audit, ruang lingkup, dan metodologi."
    },
    {
      title: "Internal Audit Worksheet",
      descEn: "Creating a worksheet to document audit procedures, findings, and conclusions.",
      descId: "Membuat lembar kerja untuk mendokumentasikan prosedur audit, temuan, dan kesimpulan."
    },
    {
      title: "Finding Worksheet",
      descEn: "Documenting specific audit findings, including issues identified and their implications.",
      descId: "Mendokumentasikan temuan audit spesifik, termasuk masalah yang diidentifikasi dan implikasinya."
    },
    {
      title: "Evidence Collection",
      descEn: "Gathering and organizing evidence to support audit findings and conclusions.",
      descId: "Mengumpulkan dan mengorganisir bukti untuk mendukung temuan dan kesimpulan audit."
    },
    {
      title: "Audit Review",
      descEn: "Reviewing audit findings and conclusions to ensure accuracy and completeness before reporting.",
      descId: "Meninjau temuan dan kesimpulan audit untuk memastikan akurasi dan kelengkapan sebelum pelaporan."
    },
    {
      title: "Internal Audit Report",
      descEn: "Preparing a comprehensive report detailing audit findings, recommendations, and management responses.",
      descId: "Menyusun laporan komprehensif yang merinci temuan audit, rekomendasi, dan tanggapan manajemen."
    },
    {
      title: "Audit Schedule",
      descEn: "Developing a timeline that outlines the audit activities, milestones, and deadlines.",
      descId: "Menyusun jadwal yang menguraikan aktivitas audit, dan timeline, dan batas waktu audit."
    },
    {
      title: "Audit Progress",
      descEn: "The process of checking how an audit is going. It involves tracking the steps taken, making sure goals are being met, and identifying any problems that arise. This helps auditors stay on schedule and make adjustments if needed to ensure a successful audit.",
      descId: "Proses memantau bagaimana audit berjalan. Ini melibatkan pelacakan langkah-langkah yang diambil, memastikan tujuan tercapai, dan mengidentifikasi masalah yang muncul. Ini membantu auditor tetap sesuai jadwal dan melakukan penyesuaian jika diperlukan untuk memastikan audit berjalan sukses."
    }
  ];

  const riskCategories = [
    {
      title: "Operational Risk",
      definition: "Risks related to the day-to-day processes and operations of a company.",
      focus: "Optimizing operational efficiency and ensuring smooth business processes."
    },
    {
      title: "Compliance Risk",
      definition: "Risks arising from non-compliance with laws, regulations, or internal policies.",
      focus: "Ensuring adherence to all applicable laws and regulations to avoid penalties."
    },
    {
      title: "IT Risk",
      definition: "Risks associated with the use of information technology and computer systems.",
      focus: "Protecting data and IT infrastructure while ensuring system availability and integrity."
    },
    {
      title: "Finance Risk",
      definition: "Risks related to financial management and potential financial losses.",
      focus: "Managing assets and liabilities wisely to minimize financial losses and ensure financial stability."
    }
  ];

  const samplingMethods = [
    {
      title: "Random Sampling",
      description: "Every item in the population has an equal chance of being selected.",
      usage: "Useful for general assessments and ensuring a representative sample.",
      example: "Randomly selecting invoices from a total list of transactions for review."
    },
    {
      title: "Stratified Sampling",
      description: "The population is divided into subgroups (strata) based on specific characteristics, and samples are taken from each stratum.",
      usage: "Ensures representation of all significant subgroups, especially when there are known variations.",
      example: "Sampling employees from different departments to assess compliance with policies."
    },
    {
      title: "Systematic Sampling",
      description: "Selecting every nth item from a sorted list after a random starting point.",
      usage: "Useful when the population is ordered and helps to simplify the sampling process.",
      example: "Selecting every 10th transaction from a list of financial records."
    },
    {
      title: "Judgmental (Non-Statistical) Sampling",
      description: "The auditor uses their judgment to select items that they believe are most representative or at risk.",
      usage: "Useful when specific transactions are believed to have higher risk.",
      example: "Selecting high-value transactions or those with unusual characteristics for detailed review."
    },
    {
      title: "Haphazard Sampling",
      description: "Items are selected without a structured approach, aiming for randomness but without a defined method.",
      usage: "Often used when time is limited or when the auditor is familiar with the population.",
      example: "Picking invoices that catch the auditor's eye during a review without a specific plan."
    },
    {
      title: "Attribute Sampling",
      description: "Used to estimate the proportion of a population that has a particular characteristic or attribute.",
      usage: "Common in compliance testing to assess the effectiveness of controls.",
      example: "Testing a sample of purchase orders to see how many have proper approvals."
    },
    {
      title: "Variables Sampling",
      description: "Used to estimate a numerical value, such as the total amount or average of a population.",
      usage: "Useful in substantive testing to estimate monetary amounts.",
      example: "Estimating the total accounts receivable balance by sampling accounts."
    }
  ];

  const findingResults = [
    {
      title: "No Significant Findings",
      description: "No areas of concern identified."
    },
    {
      title: "Minor Findings",
      description: "Issues that require attention but are not critical."
    },
    {
      title: "Significant Findings",
      description: "Material weaknesses that require immediate action."
    },
    {
      title: "Recommendations Made",
      description: "Suggestions for improvement provided."
    },
    {
      title: "Management Action Required",
      description: "Issues that need prompt management response."
    },
    {
      title: "Follow-Up Required",
      description: "Further audits needed to ensure issues are addressed."
    },
    {
      title: "Best Practices Identified",
      description: "Positive feedback on areas of strong performance."
    },
    {
      title: "Transitional Findings",
      description: "Temporary issues related to ongoing changes."
    }
  ];

  const guidelineGroups = [
    {
      id: "audit-procedures",
      title: "REFERENCE - AUDIT PROCEDURES",
      icon: "📋",
      color: "from-blue-600 to-indigo-600",
      bgColor: "from-blue-50 to-indigo-50",
      borderColor: "border-blue-100",
      data: auditProcedures,
      type: "procedures"
    },
    {
      id: "application-sections",
      title: "REFERENCE - APPLICATION SECTIONS",
      icon: "🔧",
      color: "from-emerald-600 to-teal-600",
      bgColor: "from-emerald-50 to-teal-50",
      borderColor: "border-emerald-100",
      data: applicationSections,
      type: "sections"
    },
    {
      id: "risk-category",
      title: "REFERENCE - RISK CATEGORY",
      icon: "⚠️",
      color: "from-red-600 to-rose-600",
      bgColor: "from-red-50 to-rose-50",
      borderColor: "border-red-100",
      data: riskCategories,
      type: "risks"
    },
    {
      id: "sampling-method",
      title: "GLOSSARY - SAMPLING METHOD",
      icon: "📊",
      color: "from-purple-600 to-pink-600",
      bgColor: "from-purple-50 to-pink-50",
      borderColor: "border-purple-100",
      data: samplingMethods,
      type: "sampling"
    },
    {
      id: "finding-result",
      title: "GLOSSARY - FINDING RESULT",
      icon: "🔍",
      color: "from-yellow-600 to-orange-600",
      bgColor: "from-yellow-50 to-orange-50",
      borderColor: "border-yellow-100",
      data: findingResults,
      type: "findings"
    },
    {
      id: "risk-level",
      title: "GLOSSARY - INTERNAL AUDIT RISK LEVEL",
      icon: "📈",
      color: "from-indigo-600 to-purple-600",
      bgColor: "from-indigo-50 to-purple-50",
      borderColor: "border-indigo-100",
      data: null,
      type: "risk-levels"
    }
  ];

  const renderModalContent = () => {
    const group = guidelineGroups.find(g => g.id === openModal);
    if (!group) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-white/20 p-4" onClick={() => setOpenModal(null)}>
        <div 
          className={`bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col ${group.bgColor} border-2 ${group.borderColor}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className={`bg-gradient-to-r ${group.color} p-6 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{group.icon}</span>
              <h3 className="text-2xl font-bold text-white">{group.title}</h3>
            </div>
            <button
              onClick={() => setOpenModal(null)}
              className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/20 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {group.type === "procedures" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.data.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <h4 className="font-semibold text-gray-800">{item.title}</h4>
                    </div>
                    <div className="space-y-2 text-sm ml-9">
                      <div>
                        <span className="font-semibold text-gray-700">EN: </span>
                        <span className="text-gray-600">{item.descEn}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">ID: </span>
                        <span className="text-gray-600">{item.descId}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {group.type === "sections" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.data.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <h4 className="font-semibold text-gray-800">{item.title}</h4>
                    </div>
                    <div className="space-y-2 text-sm ml-9">
                      <div>
                        <span className="font-semibold text-gray-700">EN: </span>
                        <span className="text-gray-600">{item.descEn}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">ID: </span>
                        <span className="text-gray-600">{item.descId}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {group.type === "risks" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.data.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <h4 className="font-semibold text-gray-800 text-lg">{item.title}</h4>
                    </div>
                    <div className="space-y-2 text-sm ml-9">
                      <div>
                        <span className="font-semibold text-gray-700">Definition: </span>
                        <span className="text-gray-600">{item.definition}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Focus: </span>
                        <span className="text-gray-600">{item.focus}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {group.type === "sampling" && (
              <div className="space-y-4">
                {group.data.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <h4 className="font-semibold text-gray-800 text-lg">{item.title}</h4>
                    </div>
                    <div className="space-y-2 text-sm ml-9">
                      <div>
                        <span className="font-semibold text-gray-700">Description: </span>
                        <span className="text-gray-600">{item.description}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Usage: </span>
                        <span className="text-gray-600">{item.usage}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Example: </span>
                        <span className="text-gray-600 italic">{item.example}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {group.type === "findings" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.data.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <h4 className="font-semibold text-gray-800 mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                ))}
              </div>
            )}

            {group.type === "risk-levels" && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-2 text-lg">Overall Description:</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    The classification of risk associated with internal audit activities, indicating the likelihood and impact of potential issues.
                  </p>
                  <h4 className="font-semibold text-gray-800 mb-2 text-lg">Risk Assessment:</h4>
                  <p className="text-sm text-gray-600">
                    The process of identifying and evaluating the risks related to internal audit activities, influencing audit planning and execution.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      Low Risk Level
                    </h4>
                    <p className="text-sm text-gray-600">
                      A situation where there is minimal likelihood of issues occurring, often with manageable impacts.
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-4 border border-amber-200">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                      Moderate Risk Level
                    </h4>
                    <p className="text-sm text-gray-600">
                      A condition where there is a reasonable likelihood of issues, requiring attention and potential mitigation strategies.
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                      High Risk Level
                    </h4>
                    <p className="text-sm text-gray-600">
                      A scenario where there is a significant likelihood of issues arising, necessitating immediate action and thorough investigation.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={() => setOpenModal(null)}
              className="px-6 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="bg-gradient-to-r from-[#141D38] to-[#2D3A5A] rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-row justify-between items-center">
              <div className="flex items-center justify-center md:justify-start space-x-3">
                <Image src="/images/kias-logo.webp" width={100} height={100} alt="kias logo" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white">GUIDELINES</h3>
                <p className="text-blue-100 mt-1">Reference & Glossary</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex justify-end mb-6">
          <button
            type="button"
            onClick={() => {
              if (typeof window === "undefined") return;
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
              window.location.href = "/Page/dashboard";
            }}
            className="bg-white rounded-xl shadow px-4 py-2 border border-gray-200 hover:shadow-md transition text-sm font-semibold text-gray-800 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
        </div>

        {/* Button Groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guidelineGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => setOpenModal(group.id)}
              className={`bg-gradient-to-br ${group.bgColor} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 ${group.borderColor} p-6 text-left group hover:scale-105 transform`}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-16 h-16 bg-gradient-to-r ${group.color} rounded-xl flex items-center justify-center text-3xl shadow-md group-hover:scale-110 transition-transform`}>
                  {group.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800 leading-tight">{group.title}</h3>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 font-medium">Click to view details</span>
                <svg className="w-5 h-5 text-gray-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {openModal && renderModalContent()}
    </div>
  );
}

