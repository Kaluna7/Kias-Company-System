"use client";
import { useState, useEffect } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { buttonSopReview } from "@/app/data/sopReviewConfig";

export default function SopReview() {
  const [sopStatuses, setSopStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  // Map department name to API endpoint
  const getDepartmentApiPath = (name) => {
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
  };

  // Load SOP statuses from all departments
  useEffect(() => {
    let mounted = true;
    let intervalId = null;
    
    const loadSopStatuses = async () => {
      if (!mounted) return;
      
      const statusMap = {};
      const promises = buttonSopReview
        .filter(item => item.name !== "Report")
        .map(async (item) => {
          const apiPath = getDepartmentApiPath(item.name);
          if (!apiPath) {
            statusMap[item.name] = "Not Available";
            return;
          }
          
          try {
            const res = await fetch(`/api/SopReview/${apiPath}/meta`, {
              cache: 'no-store',
            });
            
            // Check if response is OK
            if (!res.ok) {
              statusMap[item.name] = "Not Available";
              return;
            }
            
            // Check content-type before parsing JSON
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              statusMap[item.name] = "Not Available";
              return;
            }
            
            const text = await res.text();
            if (!text || text.trim().startsWith("<!DOCTYPE")) {
              statusMap[item.name] = "Not Available";
              return;
            }
            
            let data;
            try {
              data = JSON.parse(text);
            } catch (parseErr) {
              statusMap[item.name] = "Not Available";
              return;
            }
            
            if (data.success && data.rows && data.rows.length > 0) {
              const latest = data.rows[0];
              statusMap[item.name] = latest.sop_status || "Not Available";
            } else {
              statusMap[item.name] = "Not Available";
            }
          } catch (err) {
            // Silently handle errors - endpoint might not exist yet
            statusMap[item.name] = "Not Available";
          }
        });
      
      await Promise.all(promises);
      
      // Only update state if component is still mounted and data changed
      if (mounted) {
        setSopStatuses(prev => {
          // Check if data actually changed to prevent unnecessary re-renders
          const hasChanged = Object.keys(statusMap).some(
            key => prev[key] !== statusMap[key]
          );
          if (!hasChanged && Object.keys(prev).length > 0) {
            return prev; // No change, return previous state
          }
          return statusMap;
        });
        setLoading(false);
      }
    };

    // Load immediately
    loadSopStatuses();
    
    // Poll every 30 seconds for updates (realtime but not too frequent)
    intervalId = setInterval(() => {
      if (mounted) {
        loadSopStatuses();
      }
    }, 30000);
    
    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const getStatusBadge = (status) => {
    const statusUpper = (status || "").toUpperCase();
    if (statusUpper === "AVAILABLE") {
      return "bg-green-100 text-green-800";
    } else if (statusUpper === "NOT AVAILABLE") {
      return "bg-gray-100 text-gray-800";
    } else {
      return "bg-yellow-100 text-yellow-800";
    }
  };

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
                <h3 className="text-2xl font-bold text-white">SOP REVIEW</h3>
                <p className="text-blue-100 mt-1">Management Dashboard</p>
              </div>
            </div>
          </div>
        </header>

        {/* SOP Review Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">SOP Review by Department</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buttonSopReview.map((item, index) => (
              <Link 
                key={index}
                href={item.href}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 border border-gray-200 hover:border-blue-300 hover:translate-y-[-2px]"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    {item.logo && item.logo !== "/" && (
                      <Image
                        src={item.logo}
                        width={40}
                        height={40}
                        alt={item.name}
                        className="object-contain"
                      />
                    )}
                    <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
                  </div>
                </div>
                
                {/* SOP Status - hanya untuk yang bukan Report */}
                {item.name !== "Report" && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">SOP Status:</span>
                      {loading ? (
                        <span className="text-xs text-gray-400">Loading...</span>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(sopStatuses[item.name])}`}>
                          {sopStatuses[item.name] || "Not Available"}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end items-center mt-4">
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

// [#e6f7fb]
