// src/app/Page/schedule/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SchedulePage() {
  // ---- Hooks
  const { data: session, status } = useSession();
  const router = useRouter();

  const headerRef = useRef(null);
  const tableRef = useRef(null);
  const feedbackRef = useRef(null);

  const [preparerFeedbackData, setPreparerFeedbackData] = useState([
    { id: "A1.1", department_id: "A1.1", department: "Sec. Finance", startDate: "06-Jan-25", endDate: "08-Jan-25", days: 3, user: "" },
    { id: "A1.2", department_id: "A1.2", department: "Sec. Accounting", startDate: "01-Jul-25", endDate: "03-Jul-25", days: 3, user: "" },
    { id: "A1.3", department_id: "A1.3", department: "Sec. Human Resources (HRD)", startDate: "03-Feb-25", endDate: "05-Feb-25", days: 3, user: "" },
    { id: "A1.4", department_id: "A1.4", department: "Sec. General Affair (GA)", startDate: "01-Aug-25", endDate: "03-Aug-25", days: 3, user: "" },
    { id: "A1.5", department_id: "A1.5", department: "Sec. Store Design & Planner (SDP)", startDate: "18-Aug-25", endDate: "18-Aug-25", days: 1, user: "" },
    { id: "A1.6", department_id: "A1.6", department: "Sec. Tax", startDate: "13-Oct-25", endDate: "14-Oct-25", days: 2, user: "" },
    { id: "A1.7", department_id: "A1.7", department: "Sec. Security (L&P)", startDate: "01-Oct-25", endDate: "01-Oct-25", days: 1, user: "" },
    { id: "A1.8", department_id: "A1.8", department: "Sec. MIS", startDate: "03-Nov-25", endDate: "03-Nov-25", days: 1, user: "" },
    { id: "A1.9", department_id: "A1.9", department: "Sec. Merchandise", startDate: "01-May-25", endDate: "05-May-25", days: 5, user: "" },
    { id: "A1.10", department_id: "A1.10", department: "Sec. Operational", startDate: "01-Apr-25", endDate: "03-Apr-25", days: 3, user: "" },
    { id: "A1.11", department_id: "A1.11", department: "Sec. Warehouse", startDate: "04-Nov-25", endDate: "05-Nov-25", days: 2, user: "" },
  ]);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempUser, setTempUser] = useState("");

  // ---- Schedule Data
  const scheduleData = [
    { department: "Finance", incharge: "All", startDate: "06-Jan-25", endDate: "31-Jan-25", days: 26 },
    { department: "Accounting", incharge: "All", startDate: "01-Jul-25", endDate: "31-Jul-25", days: 31 },
    { department: "Human Resources (HRD)", incharge: "All", startDate: "03-Feb-25", endDate: "28-Feb-25", days: 26 },
    { department: "General Affair (GA)", incharge: "All", startDate: "01-Aug-25", endDate: "15-Aug-25", days: 15 },
    { department: "Store Design & Planner (SDP)", incharge: "All", startDate: "18-Aug-25", endDate: "29-Aug-25", days: 12 },
    { department: "Tax", incharge: "All", startDate: "13-Oct-25", endDate: "31-Oct-25", days: 19 },
    { department: "Security (L&P)", incharge: "All", startDate: "01-Oct-25", endDate: "10-Oct-25", days: 10 },
    { department: "MIS", incharge: "All", startDate: "03-Nov-25", endDate: "07-Nov-25", days: 5 },
    { department: "Merchandise", incharge: "All", startDate: "01-May-25", endDate: "30-May-25", days: 30 },
    { department: "Operational", incharge: "All", startDate: "01-Apr-25", endDate: "30-Apr-25", days: 30 },
    { department: "Warehouse", incharge: "All", startDate: "03-Nov-25", endDate: "30-Nov-25", days: 28 },
    { department: "Q1 Preparation & Meeting", incharge: "All", startDate: "03-Mar-25", endDate: "28-Mar-25", days: 26 },
    { department: "Q2 Preparation & Meeting", incharge: "All", startDate: "02-Jun-25", endDate: "30-Jun-25", days: 29 },
    { department: "Q3 Preparation & Meeting", incharge: "All", startDate: "01-Sep-25", endDate: "30-Sep-25", days: 30 },
  ];

  // Load data from API
  const loadScheduleData = async () => {
    try {
      const res = await fetch("/api/schedule");
      const data = await res.json();
      if (data.success && data.rows && data.rows.length > 0) {
        // Update preparerFeedbackData with saved data
        const updated = preparerFeedbackData.map((item) => {
          const saved = data.rows.find((r) => r.department_id === item.department_id);
          if (saved) {
            const startDate = new Date(saved.start_date);
            const endDate = new Date(saved.end_date);
            return {
              ...item,
              startDate: startDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
              endDate: endDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
              days: saved.days,
              user: saved.user_name || "",
            };
          }
          return item;
        });
        setPreparerFeedbackData(updated);
      }
    } catch (err) {
      console.error("Error loading schedule data:", err);
    }
  };

  // ---- Effects
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/Page/auth");
    }
    if (status === "authenticated") {
      loadScheduleData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { y: -50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
      );
    }
    if (tableRef.current) {
      gsap.fromTo(
        tableRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 0.3 }
      );
    }
    if (feedbackRef.current) {
      gsap.fromTo(
        feedbackRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, delay: 0.5 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Early return
  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const isQuarterly = (dept) => dept.includes("Q1") || dept.includes("Q2") || dept.includes("Q3");

  // Format date from DD-MMM-YY to YYYY-MM-DD for input
  const parseDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const monthMap = { "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06", "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12" };
      const month = monthMap[parts[1]] || "01";
      const year = "20" + parts[2];
      return `${year}-${month}-${day}`;
    }
    return "";
  };

  // Format date from YYYY-MM-DD to DD-MMM-YY
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  const handleDatePickerOpen = (row) => {
    setSelectedRow(row);
    setTempStartDate(parseDate(row.startDate));
    setTempEndDate(parseDate(row.endDate));
    setTempUser(row.user || "");
    setDatePickerOpen(true);
  };

  const handleDatePickerSave = async () => {
    if (!tempStartDate || !tempEndDate) {
      alert("Harap pilih Start dan End date!");
      return;
    }
    if (new Date(tempStartDate) > new Date(tempEndDate)) {
      alert("Start date tidak boleh lebih besar dari End date!");
      return;
    }

    try {
      const startDateISO = new Date(tempStartDate).toISOString().split("T")[0];
      const endDateISO = new Date(tempEndDate).toISOString().split("T")[0];

      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: selectedRow.department_id,
          department_name: selectedRow.department,
          user_name: tempUser,
          start_date: startDateISO,
          end_date: endDateISO,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        const updated = preparerFeedbackData.map((item) => {
          if (item.department_id === selectedRow.department_id) {
            const days = Math.ceil((new Date(tempEndDate) - new Date(tempStartDate)) / (1000 * 60 * 60 * 24)) + 1;
            return {
              ...item,
              startDate: formatDate(tempStartDate),
              endDate: formatDate(tempEndDate),
              days: days,
              user: tempUser,
            };
          }
          return item;
        });
        setPreparerFeedbackData(updated);
        setDatePickerOpen(false);
        alert("Data berhasil disimpan!");
      } else {
        alert("Gagal menyimpan data: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error saving schedule:", err);
      alert("Error menyimpan data: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F0FA] via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8" ref={headerRef}>
          <div className="bg-gradient-to-r from-[#141D38] to-[#2D3A5A] rounded-3xl shadow-2xl p-8 border border-gray-700/50">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <span className="text-2xl">📅</span>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-1">Schedule</h1>
                <p className="text-blue-100 text-lg">Project Timeline & Preparer Feedback</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Schedule Table */}
        <div className="mb-8" ref={tableRef}>
          <div className="bg-gradient-to-r from-[#141D38] to-[#2D3A5A] rounded-3xl shadow-2xl border border-gray-700/50 overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                <span className="mr-3">📊</span>
                Main Schedule
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/10 border-b border-white/20">
                    <th className="px-6 py-4 text-left text-sm font-bold text-white/90 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-white/90 uppercase tracking-wider">Incharge</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-white/90 uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-white/90 uppercase tracking-wider">End Date</th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-white/90 uppercase tracking-wider">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((row, index) => (
                    <tr
                      key={index}
                      className={`border-b border-white/10 transition-colors hover:bg-white/5 ${
                        isQuarterly(row.department) ? "bg-white/5" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-white font-medium">{row.department}</td>
                      <td className="px-6 py-4 text-white/80">{row.incharge}</td>
                      <td className="px-6 py-4 text-center text-white/90 font-medium">{row.startDate}</td>
                      <td className="px-6 py-4 text-center text-white/90 font-medium">{row.endDate}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 bg-blue-500/30 rounded-lg text-white font-semibold text-sm">
                          {row.days}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Code Procedures / A1 SOP Review Section */}
        <div ref={feedbackRef}>
          <div className="bg-gradient-to-r from-[#141D38] to-[#2D3A5A] rounded-3xl shadow-2xl border border-gray-700/50 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white/80 mb-1">Code Procedures</h2>
                  <h3 className="text-2xl font-bold text-white mb-2">A1 SOP Review</h3>
                  <h4 className="text-lg font-semibold text-blue-200 text-center">Preparer Feedback Report</h4>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/10 border-b border-white/20">
                    <th className="px-4 py-3 text-left text-sm font-bold text-white/90 uppercase tracking-wider w-24">ID</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-white/90 uppercase tracking-wider">Sec. Department</th>
                    <th className="px-6 py-3 text-center text-sm font-bold text-white/90 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-center text-sm font-bold text-white/90 uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-3 text-center text-sm font-bold text-white/90 uppercase tracking-wider">End Date</th>
                    <th className="px-6 py-3 text-center text-sm font-bold text-white/90 uppercase tracking-wider">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {preparerFeedbackData.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b border-white/10 transition-colors hover:bg-white/5"
                    >
                      <td className="px-4 py-4 text-white font-bold">{row.id}</td>
                      <td className="px-6 py-4 text-white font-medium">{row.department}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center justify-center w-32 h-10 bg-white/10 rounded-lg border border-white/20">
                          <span className="text-white/40 text-xs">{row.user || "User"}</span>
                        </div>
                      </td>
                      <td 
                        className="px-6 py-4 text-center text-white/90 font-medium cursor-pointer hover:bg-white/10 rounded transition-colors"
                        onClick={() => handleDatePickerOpen(row)}
                        title="Klik untuk mengatur Start dan End date"
                      >
                        {row.startDate}
                      </td>
                      <td 
                        className="px-6 py-4 text-center text-white/90 font-medium cursor-pointer hover:bg-white/10 rounded transition-colors"
                        onClick={() => handleDatePickerOpen(row)}
                        title="Klik untuk mengatur Start dan End date"
                      >
                        {row.endDate}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 bg-cyan-500/30 rounded-lg text-white font-semibold text-sm">
                          {row.days}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Date Picker Modal */}
      {datePickerOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-[min(500px,95vw)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Set Schedule Dates - {selectedRow.department}</h3>
              <button className="text-gray-600 hover:text-gray-800" onClick={() => setDatePickerOpen(false)}>✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">User</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={tempUser}
                  onChange={(e) => setTempUser(e.target.value)}
                  placeholder="Enter user name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  min={tempStartDate || undefined}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  className="px-4 py-2 rounded bg-gray-200 text-sm hover:bg-gray-300"
                  onClick={() => setDatePickerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                  onClick={handleDatePickerSave}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

