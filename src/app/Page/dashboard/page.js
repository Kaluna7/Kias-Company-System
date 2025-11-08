// src/app/Page/dashboard/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * Stable Dashboard: all hooks declared unconditionally.
 * Uses NextAuth session as source of truth (no Zustand writes).
 */

export default function DashboardPage() {
  // ---- Hooks (always same order)
  const { data: session, status } = useSession(); // 1
  const router = useRouter(); // 2

  const [activeCategory, setActiveCategory] = useState("all"); // 3
  const [isProfileOpen, setIsProfileOpen] = useState(false); // 4

  const headerRef = useRef(null); // 5
  const cardsRef = useRef([]); // 6
  const buttonsRef = useRef([]); // 7

  // ---- Derived data (declared BEFORE effects that use them)
  const auditItems = [
    { id: "A1", title: "SOP Review", category: "planning", href: "/Page/sop-review/" },
    { id: "B1", title: "Worksheet", category: "execution", href: "/Page/risk-assessment-dashboard/worksheet/" },
    { id: "C1", title: "Audit Review", category: "review", href: "/Page/risk-assessment-dashboard/review/" },
    { id: "A2", title: "Risk Assessment", category: "planning", href: "/Page/risk-assessment-dashboard" },
    { id: "B2", title: "Finding", category: "execution", href: "/Page/risk-assessment-dashboard/finding/" },
    { id: "C2", title: "Report", category: "review", href: "/Page/risk-assessment-dashboard/report/" },
    { id: "A3", title: "Audit Program", category: "planning", href: "/Page/audit-program/" },
    { id: "B3", title: "Evidences", category: "execution", href: "/Page/risk-assessment-dashboard/evidences/" },
    { id: "C3", title: "Guidelines", category: "review", href: "/Page/risk-assessment-dashboard/guidelines/" },
  ];

  const filteredItems = activeCategory === "all"
    ? auditItems
    : auditItems.filter((item) => item.category === activeCategory);

  // ---- Effects (always declared after derived values, stable order)
  useEffect(() => {
    // route protection
    if (status === "unauthenticated") {
      router.replace("/Page/auth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    // entrance animations (guard refs inside)
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { y: -50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
      );
    }
    if (buttonsRef.current?.length) {
      gsap.fromTo(
        buttonsRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, delay: 0.3 }
      );
    }
    if (cardsRef.current?.length) {
      gsap.fromTo(
        cardsRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, delay: 0.6 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // animate cards when filteredItems length changes
    cardsRef.current = cardsRef.current.slice(0, filteredItems.length);
    if (cardsRef.current.length) {
      gsap.fromTo(
        cardsRef.current,
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, stagger: 0.08 }
      );
    }
  }, [filteredItems.length, activeCategory]);

  // ---- Early return allowed only AFTER hooks & effects declared
  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // ---- Render values
  const userName = session?.user?.name ?? "No name";
  const userRole = session?.user?.role ?? "guest";

  const initials = userName
    .split(" ")
    .map((n) => n[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // helpers that mutate refs (OK in render)
  const addToCardsRef = (el) => {
    if (el && !cardsRef.current.includes(el)) cardsRef.current.push(el);
  };
  const addToButtonsRef = (el, index) => {
    if (el) buttonsRef.current[index] = el;
  };

  const getCategoryIcon = (category) => (category === "planning" ? "📋" : category === "execution" ? "🔍" : "📊");
  const getCategoryColor = (category) =>
    category === "planning" ? "from-blue-500 to-cyan-500" : category === "execution" ? "from-green-500 to-emerald-500" : "from-purple-500 to-indigo-500";

  const handleFilterClick = (filterId) => setActiveCategory(filterId);
  const handleViewDetail = (item) => { if (item?.href) window.location.href = item.href; };

  // ---- UI (kept identical to your design)
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F0FA] via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12" ref={headerRef}>
          <div className="bg-gradient-to-r from-[#141D38] to-[#2D3A5A] rounded-3xl shadow-2xl p-8 border border-gray-700/50">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20"><span className="text-2xl">📊</span></div>
                  <div>
                    <h1 className="text-4xl font-bold text-white mb-1">Dashboard</h1>
                    <p className="text-blue-100 text-lg">Welcome to your dashboard</p>
                  </div>
                </div>

                <div className="flex gap-8">
                  {[{ type: "planning", label: "Planning" }, { type: "execution", label: "Execution" }, { type: "review", label: "Review" }, { type: "total", label: "Total Items" }].map((stat) => (
                    <div key={stat.type} className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">{stat.type === "total" ? auditItems.length : auditItems.filter((it) => it.category === stat.type).length}</div>
                      <div className="text-sm text-blue-200 font-medium">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <button onClick={() => setIsProfileOpen((s) => !s)} className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20 hover:bg-white/20 transition-all duration-300 group">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">{initials}</div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#2D3A5A]"></div>
                      </div>
                      <div className="text-left text-white">
                        <p className="font-semibold text-base">{userName}</p>
                        <p className="text-blue-200 text-sm capitalize">{userRole}</p>
                      </div>
                      <svg className={`w-4 h-4 text-white transition-transform duration-300 ${isProfileOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    <div className={`absolute right-0 top-16 w-64 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 py-3 z-10 transition-all duration-300 transform ${isProfileOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`}>
                      <div className="px-5 py-3 border-b border-gray-200/30">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">{initials}</div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-800 text-sm">{userName}</p>
                            <p className="text-gray-600 text-xs capitalize">{userRole}</p>
                          </div>
                        </div>
                      </div>

                      <div className="px-2 py-2">
                        <a href="/help" className="w-full block"><button className="w-full flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors group text-sm"><span className="font-medium">Help & Support</span></button></a>
                      </div>

                      <div className="border-t border-gray-200/30 mt-1 pt-1 px-2">
                        <button onClick={() => signOut({ callbackUrl: "/Page/auth" })} className="w-full flex items-center px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors group text-sm"><span className="font-medium">Sign Out</span></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {[ { id: "all", label: "All Items", count: auditItems.length }, { id: "planning", label: "Planning", count: auditItems.filter((item) => item.category === "planning").length }, { id: "execution", label: "Execution", count: auditItems.filter((item) => item.category === "execution").length }, { id: "review", label: "Review", count: auditItems.filter((item) => item.category === "review").length } ].map((filter, index) => (
            <button key={filter.id} ref={(el) => addToButtonsRef(el, index)} onClick={() => handleFilterClick(filter.id)} className={`px-6 py-3.5 rounded-2xl font-semibold transition-all duration-300 flex items-center space-x-3 border backdrop-blur-sm ${activeCategory === filter.id ? "bg-[#141D38] text-white shadow-lg transform scale-105 border-[#2D3A5A]" : "bg-white/80 text-gray-700 shadow-md hover:shadow-lg hover:bg-white border-white/50"}`}>
              <span className="text-sm">{filter.label}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${activeCategory === filter.id ? "bg-white/20 text-white" : "bg-[#E6F0FA] text-[#141D38]"}`}>{filter.count}</span>
            </button>
          ))}        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <div key={item.id} ref={addToCardsRef} className="group relative">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 border border-white/60 overflow-hidden group-hover:transform group-hover:scale-[1.02] h-full flex flex-col">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${getCategoryColor(item.category)} flex items-center justify-center text-white text-lg shadow-md`}>{getCategoryIcon(item.category)}</div>
                      <div><span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{item.id}</span></div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r ${getCategoryColor(item.category)} text-white shadow-sm capitalize`}>{item.category}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-8 group-hover:text-gray-900 transition-colors leading-tight">{item.title}</h3>
                  <div className="mt-auto">
                    <button onClick={() => handleViewDetail(item)} className="w-full bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center space-x-2 border border-[#2D3A5A] text-sm">
                      <span>View Details</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
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
