// ElegantAuditDashboard.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function ElegantAuditDashboard() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const headerRef = useRef(null);
  const cardsRef = useRef([]);
  const buttonsRef = useRef([]);

  const auditItems = [
    { id: "A1", title: "SOP Review", category: "planning", href: "/Page/risk-assessment-dashboard/sop/" },
    { id: "B1", title: "Worksheet", category: "execution", href: "/Page/risk-assessment-dashboard/worksheet/" },
    { id: "C1", title: "Audit Review", category: "review", href: "/Page/risk-assessment-dashboard/review/" },
    { id: "A2", title: "Risk Assessment", category: "planning", href: "/Page/risk-assessment-dashboard" },
    { id: "B2", title: "Finding", category: "execution", href: "/Page/risk-assessment-dashboard/finding/" },
    { id: "C2", title: "Report", category: "review", href: "/Page/risk-assessment-dashboard/report/" },
    { id: "A3", title: "Audit Program", category: "planning", href: "/Page/audit-program/" },
    { id: "B3", title: "Evidences", category: "execution", href: "/Page/risk-assessment-dashboard/evidences/" },
    { id: "C3", title: "Guidelines", category: "review", href: "/Page/risk-assessment-dashboard/guidelines/" },
  ];

  const filteredItems =
    activeCategory === "all"
      ? auditItems
      : auditItems.filter((item) => item.category === activeCategory);

  // GSAP Animations
  useEffect(() => {
    gsap.fromTo(
      headerRef.current,
      { y: -50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
    );

    gsap.fromTo(
      buttonsRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, delay: 0.3 }
    );

    gsap.fromTo(
      cardsRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, delay: 0.6 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cardsRef.current = cardsRef.current.slice(0, filteredItems.length);

    gsap.fromTo(
      cardsRef.current,
      { x: -20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.5, stagger: 0.08 }
    );
  }, [activeCategory, filteredItems.length]);

  const addToCardsRef = (el) => {
    if (el && !cardsRef.current.includes(el)) {
      cardsRef.current.push(el);
    }
  };

  const addToButtonsRef = (el, index) => {
    if (el) {
      buttonsRef.current[index] = el;
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case "planning":
        return "📋";
      case "execution":
        return "🔍";
      case "review":
        return "📊";
      default:
        return "📁";
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "planning":
        return "from-blue-500 to-cyan-500";
      case "execution":
        return "from-green-500 to-emerald-500";
      case "review":
        return "from-purple-500 to-indigo-500";
      default:
        return "from-gray-500 to-slate-500";
    }
  };

  const handleFilterClick = (filterId) => {
    setActiveCategory(filterId);
  };

  const handleNotificationClick = () => {
    window.location.href = "/notifications";
  };

  const handleViewDetail = (item) => {
    if (item?.href) {
      window.location.href = item.href;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F0FA] via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-12" ref={headerRef}>
          <div className="bg-gradient-to-r from-[#141D38] to-[#2D3A5A] rounded-3xl shadow-2xl p-8 border border-gray-700/50">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div>
                    <a href="/risk-assessment" className="no-underline">
                      <h1 className="text-4xl font-bold text-white mb-1">Dashboard</h1>
                    </a>
                    <p className="text-blue-100 text-lg">Still thinking about the description</p>
                  </div>
                </div>

                {/* Stats Overview */}
                <div className="flex gap-8">
                  {[
                    { type: "planning", label: "Planning", count: auditItems.filter((item) => item.category === "planning").length },
                    { type: "execution", label: "Execution", count: auditItems.filter((item) => item.category === "execution").length },
                    { type: "review", label: "Review", count: auditItems.filter((item) => item.category === "review").length },
                    { type: "total", label: "Total Items", count: auditItems.length }
                  ].map((stat, index) => (
                    <div key={stat.type} className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">{stat.count}</div>
                      <div className="text-sm text-blue-200 font-medium">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Profile Section */}
              <div className="relative">
                <div className="flex items-center space-x-3">
                  {/* Notification Bell */}
                 

                  {/* Profile Card */}
                  <div className="relative">
                    <button
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20 hover:bg-white/20 transition-all duration-300 group"
                    >
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">AM</div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#2D3A5A]"></div>
                      </div>
                      <div className="text-left text-white">
                        <p className="font-semibold text-base">No name</p>
                        <p className="text-blue-200 text-sm">I dk</p>
                      </div>
                      <svg className={`w-4 h-4 text-white transition-transform duration-300 ${isProfileOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Profile Dropdown */}
                    <div className={`absolute right-0 top-16 w-64 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 py-3 z-10 transition-all duration-300 transform ${isProfileOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
                      <div className="px-5 py-3 border-b border-gray-200/30">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">AM</div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-800 text-sm">Who i am?</p>
                            <p className="text-gray-600 text-xs">Just kidding</p>
                          </div>
                        </div>
                      </div>

                      <div className="px-2 py-2">
                        <a href="/help" className="w-full block">
                          <button className="w-full flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors group text-sm">
                            <svg className="w-4 h-4 text-gray-500 mr-3 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">Help & Support</span>
                          </button>
                        </a>
                      </div>

                      <div className="border-t border-gray-200/30 mt-1 pt-1 px-2">
                        <a href="/logout" className="w-full block">
                          <button className="w-full flex items-center px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors group text-sm">
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="font-medium">Sign Out</span>
                          </button>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {[
            { id: "all", label: "All Items", count: auditItems.length },
            { id: "planning", label: "Planning", count: auditItems.filter((item) => item.category === "planning").length },
            { id: "execution", label: "Execution", count: auditItems.filter((item) => item.category === "execution").length },
            { id: "review", label: "Review", count: auditItems.filter((item) => item.category === "review").length },
          ].map((filter, index) => (
            <button
              key={filter.id}
              ref={(el) => addToButtonsRef(el, index)}
              onClick={() => handleFilterClick(filter.id)}
              className={`px-6 py-3.5 rounded-2xl font-semibold transition-all duration-300 flex items-center space-x-3 border backdrop-blur-sm ${
                activeCategory === filter.id
                  ? "bg-[#141D38] text-white shadow-lg transform scale-105 border-[#2D3A5A]"
                  : "bg-white/80 text-gray-700 shadow-md hover:shadow-lg hover:bg-white border-white/50"
              }`}
            >
              <span className="text-sm">{filter.label}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                activeCategory === filter.id ? "bg-white/20 text-white" : "bg-[#E6F0FA] text-[#141D38]"
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* Audit Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <div key={item.id} ref={addToCardsRef} className="group relative">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 border border-white/60 overflow-hidden group-hover:transform group-hover:scale-[1.02] h-full flex flex-col">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="p-6 flex-1">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${getCategoryColor(item.category)} flex items-center justify-center text-white text-lg shadow-md`}>
                        {getCategoryIcon(item.category)}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{item.id}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r ${getCategoryColor(item.category)} text-white shadow-sm capitalize`}>
                      {item.category}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-800 mb-8 group-hover:text-gray-900 transition-colors leading-tight">
                    {item.title}
                  </h3>

                  {/* Action */}
                  <div className="mt-auto">
                    {item.href ? (
                      <a href={item.href} className="no-underline">
                        <button className="w-full bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center space-x-2 border border-[#2D3A5A] text-sm">
                          <span>View Details</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </a>
                    ) : (
                      <button onClick={() => handleViewDetail(item)} className="w-full bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center space-x-2 border border-[#2D3A5A] text-sm">
                        <span>View Details</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}