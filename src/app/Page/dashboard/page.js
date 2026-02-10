// src/app/Page/dashboard/page.js
"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import ChatSidebar from "./ChatSidebar";

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
  const [progress, setProgress] = useState({ loading: true, error: null, modules: [] }); // 5
  const [progressModuleKey, setProgressModuleKey] = useState("sop-review"); // 6
  const [expandedModuleKey, setExpandedModuleKey] = useState(null); // 7
  const [progressUsers, setProgressUsers] = useState([]); // 8 (admin only)
  const [progressUserName, setProgressUserName] = useState(""); // 9 (admin selected userName)
  const [archivingModuleKey, setArchivingModuleKey] = useState(""); // 10

  // ---- Derived data (declared BEFORE effects that use them)
  const isAdmin = (session?.user?.role || "").toLowerCase() === "admin";

  const baseAuditItems = [
    { id: "A1", title: "SOP Review", category: "planning", href: "/Page/sop-review/" },
    { id: "B1", title: "Worksheet", category: "execution", href: "/Page/worksheet/" },
    { id: "C1", title: "Audit Review", category: "review", href: "/Page/audit-review/" },
    { id: "A2", title: "Risk Assessment", category: "planning", href: "/Page/risk-assessment-dashboard" },
    { id: "B2", title: "Finding", category: "execution", href: "/Page/audit-finding/" },
    { id: "C2", title: "Report", category: "review", href: "/Page/risk-assessment-dashboard/report/" },
    { id: "A3", title: "Audit Program", category: "planning", href: "/Page/audit-program/" },
    { id: "B3", title: "Evidences", category: "execution", href: "/Page/evidence/" },
    { id: "C3", title: "Guidelines", category: "review", href: "/Page/audit-review/guidelines/" },
  ];

  const auditItems = isAdmin
    ? [...baseAuditItems, { id: "D1", title: "Schedule", category: "planning", href: "/Page/schedule/" }]
    : baseAuditItems;

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
    let mounted = true;
    async function loadProgress() {
      try {
        const isAdmin = (session?.user?.role || "").toLowerCase() === "admin";
        const userName = (session?.user?.name || "").trim();
        const effectiveUserName = isAdmin ? (progressUserName || "") : userName;
        const qs = effectiveUserName ? `?userName=${encodeURIComponent(effectiveUserName)}` : "";

        const res = await fetch(`/api/dashboard/progress${qs}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (!res.ok || !json?.success) {
          setProgress({ loading: false, error: json?.error || `HTTP ${res.status}`, modules: [] });
          return;
        }
        const modules = Array.isArray(json.modules) ? json.modules : [];
        setProgress({ loading: false, error: null, modules });
        if (modules.length > 0 && !modules.some((m) => m.key === progressModuleKey)) {
          setProgressModuleKey(modules[0].key);
        }
      } catch (e) {
        if (!mounted) return;
        setProgress({ loading: false, error: e?.message || String(e), modules: [] });
      }
    }
    loadProgress();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.name, session?.user?.role, progressUserName]);

  const archiveModule = async (moduleKey) => {
    if (!confirm(`Apakah Anda yakin ingin menyelesaikan dan menghapus schedule untuk ${moduleKey}? Semua schedule untuk module ini akan dihapus dari main schedule dan module schedule.`)) {
      return;
    }
    
    try {
      setArchivingModuleKey(moduleKey);
      // Archive with scope "module" - this will hide from progress and delete all schedules
      const res = await fetch("/api/schedule/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_key: moduleKey, scope: "module" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        alert("Gagal menyelesaikan: " + (json?.error || `HTTP ${res.status}`));
        return;
      }
      
      // Reload progress
      setProgress((p) => ({ ...p, loading: true }));
      const isAdminNow = (session?.user?.role || "").toLowerCase() === "admin";
      const userName = (session?.user?.name || "").trim();
      const effectiveUserName = isAdminNow ? (progressUserName || "") : userName;
      const qs = effectiveUserName ? `?userName=${encodeURIComponent(effectiveUserName)}` : "";
      const r2 = await fetch(`/api/dashboard/progress${qs}`, { cache: "no-store" });
      const j2 = await r2.json().catch(() => null);
      if (r2.ok && j2?.success) {
        const modules = Array.isArray(j2.modules) ? j2.modules : [];
        setProgress({ loading: false, error: null, modules });
      } else {
        setProgress({ loading: false, error: j2?.error || `HTTP ${r2.status}`, modules: [] });
      }
      
      alert(`${moduleKey} berhasil diselesaikan dan schedule telah dihapus! Anda dapat membuat schedule baru untuk module ini.`);
    } catch (e) {
      alert("Gagal menyelesaikan: " + (e?.message || String(e)));
    } finally {
      setArchivingModuleKey("");
    }
  };


  useEffect(() => {
    let mounted = true;
    async function loadUsersIfAdmin() {
      try {
        const isAdmin = (session?.user?.role || "").toLowerCase() === "admin";
        if (!isAdmin) {
          setProgressUsers([]);
          setProgressUserName("");
          return;
        }
        const res = await fetch("/api/users", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (res.ok && json?.success && Array.isArray(json.users)) {
          setProgressUsers(json.users);
        } else {
          setProgressUsers([]);
        }
      } catch {
        if (!mounted) return;
        setProgressUsers([]);
      }
    }
    loadUsersIfAdmin();
    return () => { mounted = false; };
  }, [session?.user?.role]);

  // ---- Render values
  const isSessionLoading = status === "loading";
  const userName = isSessionLoading ? "Loading..." : (session?.user?.name ?? "No name");
  const userRole = isSessionLoading ? "loading" : (session?.user?.role ?? "guest");

  const initials = userName
    .split(" ")
    .map((n) => n[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const getCategoryIcon = (category) => (category === "planning" ? "📋" : category === "execution" ? "🔍" : "📊");
  const getCategoryColor = (category) =>
    category === "planning" ? "from-blue-500 to-cyan-500" : category === "execution" ? "from-green-500 to-emerald-500" : "from-purple-500 to-indigo-500";

  const handleFilterClick = (filterId) => setActiveCategory(filterId);
  const handleViewDetail = (item) => { if (item?.href) window.location.href = item.href; };

  const selectedModule = progress.modules.find((m) => m.key === progressModuleKey) || null;

  const toggleExpanded = (key) => {
    setExpandedModuleKey((prev) => (prev === key ? null : key));
  };

  // ---- UI (kept identical to your design, with floating chat sidebar)
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F0FA] via-white to-blue-50 relative">
      {/* Floating hoverable chat sidebar on the left (overlay, tidak menggeser layout) */}
      <ChatSidebar currentUser={session?.user} />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
        <header className="mb-12">
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
            <button key={filter.id} onClick={() => handleFilterClick(filter.id)} className={`px-6 py-3.5 rounded-2xl font-semibold transition-all duration-300 flex items-center space-x-3 border backdrop-blur-sm ${activeCategory === filter.id ? "bg-[#141D38] text-white shadow-lg transform scale-105 border-[#2D3A5A]" : "bg-white/80 text-gray-700 shadow-md hover:shadow-lg hover:bg-white border-white/50"}`}>
              <span className="text-sm">{filter.label}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${activeCategory === filter.id ? "bg-white/20 text-white" : "bg-[#E6F0FA] text-[#141D38]"}`}>{filter.count}</span>
            </button>
          ))}        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <div key={item.id} className="group relative">
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
        <footer>
          <div className="mt-10 bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl shadow-lg p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white flex items-center justify-center shadow-md">
                  📈
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-800">Progress</div>
                  <div className="text-sm text-gray-500">SOP Review · Worksheet · Audit Finding · Evidence</div>
                </div>
              </div>

              {(String(userRole || "").toLowerCase() === "admin") && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="text-xs font-bold text-gray-600">View as user</div>
                  <select
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                    value={progressUserName}
                    onChange={(e) => setProgressUserName(e.target.value)}
                  >
                    <option value="">All users (no filter)</option>
                    {progressUsers.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4">
              {progress.loading && (
                <div className="text-sm text-gray-500">Loading progress...</div>
              )}
              {!progress.loading && progress.error && (
                <div className="text-sm text-red-600">Failed to load progress: {progress.error}</div>
              )}
              {!progress.loading && !progress.error && (
                <div className="space-y-3">
                  {progress.modules.map((m) => {
                    const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
                    const isOpen = expandedModuleKey === m.key;
                    const showFinish = String(userRole || "").toLowerCase() === "admin" && m.total > 0 && m.done === m.total;

                    return (
                      <div key={m.key} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Row: name | bar | dropdown */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
                          <div className="flex items-center justify-between md:justify-start md:w-[220px]">
                            <div className="text-sm font-bold text-gray-800">{m.label}</div>
                            <div className="md:hidden text-xs font-bold text-gray-700">
                              {m.done}/{m.total}
                            </div>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="hidden md:block text-xs font-bold text-gray-700 w-[64px] text-right">
                                {m.done}/{m.total}
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end md:w-[180px]">
                            <div className="flex items-center gap-2">
                              {showFinish && (
                                <button
                                  type="button"
                                  disabled={archivingModuleKey === m.key}
                                  onClick={() => archiveModule(m.key)}
                                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                                  title="Archive/hide this module (finished)"
                                >
                                  {archivingModuleKey === m.key ? "Saving..." : "Finish"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleExpanded(m.key)}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#141D38] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
                              >
                                <span>{isOpen ? "Hide" : "Details"}</span>
                                <svg
                                  className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Dropdown content */}
                        {isOpen && (
                          <div className="px-4 pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {m.departments.map((d) => (
                                <div
                                  key={d.key}
                                  className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3"
                                >
                                  <div className="text-sm font-semibold text-gray-800">{d.label}</div>
                                  <span
                                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                      d.status === "finish"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {d.status === "finish" ? "Done" : "Progress"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </footer>
        </div>
      </div>
    </div>
  );
}
