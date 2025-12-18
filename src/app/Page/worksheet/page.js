// app/page.js
import Link from 'next/link';
import Image from 'next/image';

export default function Worksheet() {
  const worksheets = [
    { id: 'B1.1', department: 'FINANCE', statusWP: 'Not Checked', status: 'In Progress', date: '00-Jan-00' },
    { id: 'B1.2', department: 'ACCOUNTING', statusWP: 'Not Checked', status: 'Draft', date: '00-Jan-00' },
    { id: 'B1.3', department: 'HPD', statusWP: 'Not Checked', status: 'In Progress', date: '00-Jan-00' },
    { id: 'B1.4', department: 'G&A', statusWP: 'Not Checked', status: 'Draft', date: '00-Jan-00' },
    { id: 'B1.5', department: 'DESIGN STORE PLANNER', statusWP: 'Not Checked', status: 'Draft', date: '00-Jan-00' },
    { id: 'B1.6', department: 'TAX', statusWP: 'Not Checked', status: 'Draft', date: '00-Jan-00' },
    { id: 'B1.7', department: 'SECURITY L&P', statusWP: 'Not Checked', status: 'Draft', date: '00-Jan-00' },
    { id: 'B1.8', department: 'MIS', statusWP: 'Not Checked', status: 'Draft', date: '00-Jan-00' },
    { id: 'B1.9', department: 'MERCHANDISE', statusWP: 'Not Checked', status: 'Draft', date: '00-Jan-00' },
    { id: 'B1.10', department: 'OPERATIONAL', statusWP: 'Not Checked', status: 'In Progress', date: '00-Jan-00' },
    { id: 'B1.11', department: 'WAREHOUSE', statusWP: 'Not Checked', status: 'Draft', date: '00-Jan-00' }
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
                    <h3 className="text-2xl font-bold text-white">B.1 WORKSHEET</h3>
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
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-gray-800">{worksheets.filter(item => item.status === 'In Progress').length}</p>
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
                <p className="text-2xl font-bold text-gray-800">{worksheets.filter(item => item.statusWP === 'Not Checked').length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Worksheets Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Worksheets by Department</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {worksheets.map((worksheet, index) => (
              <Link 
                key={worksheet.id}
                href={`/worksheet/${worksheet.id}`}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px]"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">{worksheet.department}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    worksheet.status === 'In Progress' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {worksheet.status}
                  </span>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-500">Last updated</span>
                  <span className="text-sm font-medium text-gray-700">{worksheet.date}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {worksheet.statusWP}
                  </span>
                  <div className="text-blue-600 flex items-center">
                    <span className="text-sm font-medium">Open</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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