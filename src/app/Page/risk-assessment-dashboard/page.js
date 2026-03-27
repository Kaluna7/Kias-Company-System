import Link from 'next/link';
import Image from 'next/image';
import { buttonRiskAssessment } from "@/app/data/riskAssessmentConfig";

export const dynamic = "force-dynamic";

export default async function RiskAssessmentDashboard({ searchParams }) {
  const params = await searchParams;
  const yearParam = params?.year;
  const yearQuery = yearParam ? `?year=${encodeURIComponent(yearParam)}` : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/Page/dashboard${yearQuery}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </Link>
        </div>
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
                    alt="KIAS logo"
                    className="drop-shadow-lg"
                    priority
                    sizes="(max-width: 768px) 64px, 100px"
                  />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-3xl font-bold text-white" style={{ fontFamily: "system-ui, sans-serif", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>RISK ASSESSMENT</h3>
                <p className="text-blue-200 mt-1 font-medium">Management Dashboard</p>
              </div>
            </div>
          </div>
        </header>

        {/* Risk Assessment Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Risk Assessment by Department</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buttonRiskAssessment.map((item, index) => (
              <Link 
                key={index}
                href={`${item.href}${yearQuery}`}
                prefetch={true}
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
                        />
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
                  </div>
                </div>
                
                <div className="flex justify-end items-center mt-4">
                  <div className="text-blue-600 flex items-center group-hover:text-blue-700 transition-colors">
                    <span className="text-sm font-semibold">Open</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  );
}
