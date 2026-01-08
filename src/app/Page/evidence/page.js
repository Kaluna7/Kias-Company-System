// app/page.js
import Link from 'next/link';
import Image from 'next/image';

export default function Evidence() {
  const evidences = [
    { id: 'E1.1', department: 'FINANCE' },
    { id: 'E1.2', department: 'ACCOUNTING' },
    { id: 'E1.3', department: 'HPD' },
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header dengan Logo */}
        <header className="mb-8">
          <div className="bg-[#141D38] rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-row md:flex-row justify-between items-center">
                <div className="flex items-center justify-center md:justify-start space-x-3">
                  <div>
                    <Image
                    src="/images/kias-logo.png"
                    width={100}
                    height={100}
                    alt='kias logo'
                    />
                  </div>
                </div>
                <div className="text-center">
                    <h3 className="text-2xl font-bold text-white">E.1 EVIDENCE</h3>
                    <p className="text-blue-100 mt-1">Management Dashboard</p>
                </div>
            </div>
          </div>
        </header>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              
              return (
              <Link 
                key={evidence.id}
                href={`/Page/evidence/${deptPath}`}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px]"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">{evidence.department}</h3>
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
          </div>
        </div>

      </div>
    </div>
  );
}

