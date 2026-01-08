// app/b2-audit/page.js
import Link from 'next/link';
import Image from 'next/image';

export default function B2AuditFinding() {
  const auditFindings = [
    { id: 'B2.1', department: 'FINANCE', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.2', department: 'ACCOUNTING', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.3', department: 'HRD', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.4', department: 'G&A', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.5', department: 'STORE DESIGN PLANNER', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.6', department: 'TAX', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.7', department: 'SECURITY L&P', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.8', department: 'MIS', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.9', department: 'MERCHANDISE', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.10', department: 'OPERATIONAL', statusWP: 'Not Checked', process: 'IN PROGRESS' },
    { id: 'B2.11', department: 'WAREHOUSE', statusWP: 'Not Checked', process: 'IN PROGRESS' }
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
                <p className="text-2xl font-bold text-gray-800">{auditFindings.filter(item => item.statusWP === 'Not Checked').length}</p>
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
                <p className="text-2xl font-bold text-gray-800">0</p>
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
              
              return (
              <Link 
                key={finding.id}
                href={`/Page/audit-finding/${deptPath}`}
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
                      {finding.statusWP}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {finding.process}
                    </span>
                  </div>
                </div>
                
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
          </div>
        </div>
      </div>
    </div>
  );
}