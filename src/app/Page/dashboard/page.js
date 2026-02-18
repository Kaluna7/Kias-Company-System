// src/app/Page/dashboard/page.js
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/contexts/ToastContext";

const ChatSidebar = dynamic(() => import("./ChatSidebar"), { ssr: false });

const BASE_AUDIT_ITEMS = [
  { id: "A1", title: "SOP Review", category: "planning", href: "/Page/sop-review/" },
  { id: "B1", title: "Worksheet", category: "execution", href: "/Page/worksheet/" },
  { id: "C1", title: "Audit Review", category: "review", href: "/Page/audit-review/" },
  { id: "A2", title: "Risk Assessment", category: "planning", href: "/Page/risk-assessment-dashboard" },
  { id: "B2", title: "Finding", category: "execution", href: "/Page/audit-finding/" },
  { id: "C2", title: "Report", category: "review", href: "/Page/risk-assessment-dashboard/report/" },
  { id: "A3", title: "Audit Program", category: "planning", href: "/Page/audit-program/" },
  { id: "B3", title: "Evidences", category: "execution", href: "/Page/evidence/" },
  { id: "C3", title: "Guidelines", category: "review", href: "/Page/guidelines/" },
];

function getCategoryIcon(category) {
  return category === "planning" ? "📋" : category === "execution" ? "🔍" : "📊";
}
function getCategoryColor(category) {
  return category === "planning" ? "from-blue-500 to-cyan-500" : category === "execution" ? "from-green-500 to-emerald-500" : "from-purple-500 to-indigo-500";
}

/**
 * Stable Dashboard: all hooks declared unconditionally.
 * Optimized for mobile: lazy ChatSidebar, memoized data, reduced heavy CSS.
 */
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState("all");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [progress, setProgress] = useState({ loading: true, error: null, modules: [] });
  const [progressModuleKey, setProgressModuleKey] = useState("sop-review");
  const [expandedModuleKey, setExpandedModuleKey] = useState(null);
  const [progressUsers, setProgressUsers] = useState([]);
  const [progressUserName, setProgressUserName] = useState("");
  const [archivingModuleKey, setArchivingModuleKey] = useState("");

  const role = (session?.user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "reviewer";

  const auditItems = useMemo(
    () => (isAdmin ? [...BASE_AUDIT_ITEMS, { id: "D1", title: "Schedule", category: "planning", href: "/Page/schedule/" }] : BASE_AUDIT_ITEMS),
    [isAdmin]
  );

  const filteredItems = useMemo(
    () => (activeCategory === "all" ? auditItems : auditItems.filter((item) => item.category === activeCategory)),
    [activeCategory, auditItems]
  );

  const statsAndFilters = useMemo(() => {
    const planning = auditItems.filter((it) => it.category === "planning").length;
    const execution = auditItems.filter((it) => it.category === "execution").length;
    const review = auditItems.filter((it) => it.category === "review").length;
    return {
      stats: [
        { type: "planning", label: "Planning", count: planning },
        { type: "execution", label: "Execution", count: execution },
        { type: "review", label: "Review", count: review },
        { type: "total", label: "Total Items", count: auditItems.length },
      ],
      filters: [
        { id: "all", label: "All Items", count: auditItems.length },
        { id: "planning", label: "Planning", count: planning },
        { id: "execution", label: "Execution", count: execution },
        { id: "review", label: "Review", count: review },
      ],
    };
  }, [auditItems]);

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
        const role = (session?.user?.role || "").toLowerCase();
        const isAdmin = role === "admin" || role === "reviewer";
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

  useEffect(() => {
    let mounted = true;
    async function loadUsersIfAdmin() {
      try {
        const role = (session?.user?.role || "").toLowerCase();
        const isAdmin = role === "admin" || role === "reviewer";
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

  const handleFilterClick = useCallback((filterId) => setActiveCategory(filterId), []);
  const handleViewDetail = useCallback((item) => {
    if (item?.href) window.location.href = item.href;
  }, []);
  const toggleExpanded = useCallback((key) => {
    setExpandedModuleKey((prev) => (prev === key ? null : key));
  }, []);

  const archiveModule = useCallback(
    async (moduleKey) => {
      if (!confirm(`Apakah Anda yakin ingin menyelesaikan dan menghapus schedule untuk ${moduleKey}? Semua schedule untuk module ini akan dihapus dari main schedule dan module schedule.`)) {
        return;
      }
      try {
        setArchivingModuleKey(moduleKey);
        const res = await fetch("/api/schedule/archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module_key: moduleKey, scope: "module" }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          toast.show("Gagal menyelesaikan: " + (json?.error || `HTTP ${res.status}`), "error");
          return;
        }
        setProgress((p) => ({ ...p, loading: true }));
        const roleNow = (session?.user?.role || "").toLowerCase();
        const isAdminNow = roleNow === "admin" || roleNow === "reviewer";
        const userName = (session?.user?.name || "").trim();
        const effectiveUserName = isAdminNow ? progressUserName : userName;
        const qs = effectiveUserName ? `?userName=${encodeURIComponent(effectiveUserName)}` : "";
        const r2 = await fetch(`/api/dashboard/progress${qs}`, { cache: "no-store" });
        const j2 = await r2.json().catch(() => null);
        if (r2.ok && j2?.success) {
          const modules = Array.isArray(j2.modules) ? j2.modules : [];
          setProgress({ loading: false, error: null, modules });
        } else {
          setProgress({ loading: false, error: j2?.error || `HTTP ${r2.status}`, modules: [] });
        }
        toast.show(`${moduleKey} berhasil diselesaikan dan schedule telah dihapus! Anda dapat membuat schedule baru untuk module ini.`, "success");
      } catch (e) {
        toast.show("Gagal menyelesaikan: " + (e?.message || String(e)), "error");
      } finally {
        setArchivingModuleKey("");
      }
    },
    [session?.user?.name, session?.user?.role, progressUserName, toast]
  );

  // ---- UI (responsive: top bar with profile top-right on all screens)
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E6F0FA] via-white to-blue-50 relative">
      <ChatSidebar currentUser={session?.user} />

      <div className="p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
        {/* Header bar: responsive, profile always top-right */}
        <header className="mb-6 sm:mb-12">
          <div className="bg-gradient-to-r from-[#141D38] to-[#2D3A5A] rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-700/50">
            {/* Top row: logo + title on left, profile on right (same on mobile & desktop) */}
            <div className="flex flex-row justify-between items-center gap-3 mb-4 sm:mb-6">
              <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-white/20 flex-shrink-0">
                  <span className="text-lg sm:text-2xl">📊</span>
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white truncate">Dashboard</h1>
                  <p className="text-blue-100 text-sm sm:text-base md:text-lg truncate">Welcome to your dashboard</p>
                </div>
              </div>

              {/* Profile: top-right bar - compact on mobile (avatar only), full on md+ */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setIsProfileOpen((s) => !s)}
                  className="flex items-center space-x-2 sm:space-x-4 bg-white/10 rounded-xl sm:rounded-2xl pl-2 pr-2 sm:px-5 py-2 sm:py-3 border border-white/20 hover:bg-white/20 transition-colors duration-200"
                  aria-label="Profile menu"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-lg">
                      {initials}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full border-2 border-[#2D3A5A]"></div>
                  </div>
                  <div className="text-left text-white hidden md:block">
                    <p className="font-semibold text-sm xl:text-base truncate max-w-[120px] xl:max-w-none">{userName}</p>
                    <p className="text-blue-200 text-xs capitalize">{userRole}</p>
                  </div>
                  <svg className={`w-4 h-4 text-white transition-transform duration-300 flex-shrink-0 hidden sm:block ${isProfileOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {/* Dropdown: below profile, right-aligned */}
                <div className={`absolute right-0 top-full mt-2 w-56 sm:w-64 bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-200 py-3 z-20 transition-[opacity,transform] duration-200 ${isProfileOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none invisible"}`}>
                  <div className="px-4 py-3 border-b border-gray-200/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{initials}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 text-sm truncate">{userName}</p>
                        <p className="text-gray-600 text-xs capitalize">{userRole}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-2 py-2">
                    <a href="/help" className="block"><button className="w-full flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors text-sm"><span className="font-medium">Help & Support</span></button></a>
                  </div>
                  <div className="border-t border-gray-200/30 mt-1 pt-1 px-2">
                    <button onClick={() => signOut({ callbackUrl: "/Page/auth" })} className="w-full flex items-center px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm"><span className="font-medium">Sign Out</span></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats row: responsive grid */}
            <div className="grid grid-cols-2 md:flex md:gap-6 lg:gap-8 gap-3">
              {statsAndFilters.stats.map((stat) => (
                <div key={stat.type} className="text-center py-2 md:py-0">
                  <div className="text-2xl sm:text-3xl font-bold text-white">{stat.count}</div>
                  <div className="text-xs sm:text-sm text-blue-200 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center mb-8 sm:mb-12">
          {statsAndFilters.filters.map((filter) => (
            <button key={filter.id} onClick={() => handleFilterClick(filter.id)} className={`px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl font-semibold transition-colors duration-200 flex items-center space-x-2 sm:space-x-3 border text-sm sm:text-base ${activeCategory === filter.id ? "bg-[#141D38] text-white shadow-lg border-[#2D3A5A]" : "bg-white/90 text-gray-700 shadow-md hover:bg-white border-white/50"}`}>
              <span>{filter.label}</span>
              <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-bold ${activeCategory === filter.id ? "bg-white/20 text-white" : "bg-[#E6F0FA] text-[#141D38]"}`}>{filter.count}</span>
            </button>
          ))}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="group relative">
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-100 overflow-hidden h-full flex flex-col">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                <div className="p-4 sm:p-6 flex-1">
                  <div className="flex justify-between items-start mb-4 sm:mb-6">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-r ${getCategoryColor(item.category)} flex items-center justify-center text-white text-base sm:text-lg shadow-md flex-shrink-0`}>{getCategoryIcon(item.category)}</div>
                      <div><span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{item.id}</span></div>
                    </div>
                    <span className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r ${getCategoryColor(item.category)} text-white shadow-sm capitalize flex-shrink-0`}>{item.category}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6 sm:mb-8 group-hover:text-gray-900 transition-colors leading-tight">{item.title}</h3>
                  <div className="mt-auto">
                    <button onClick={() => handleViewDetail(item)} className="w-full bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white px-4 py-2.5 sm:py-3 rounded-xl font-semibold hover:shadow-lg transition-shadow duration-200 flex items-center justify-center space-x-2 border border-[#2D3A5A] text-sm">
                      <span>View Details</span>
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <footer>
          <div className="mt-6 sm:mt-10 bg-white border border-gray-100 rounded-xl sm:rounded-2xl shadow-md p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#141D38] to-[#2D3A5A] text-white flex items-center justify-center shadow-md flex-shrink-0">
                  📈
                </div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-bold text-gray-800">Progress</div>
                  <div className="text-xs sm:text-sm text-gray-500 truncate">SOP Review · Worksheet · Audit Finding · Evidence</div>
                </div>
              </div>

              {(() => {
                const role = String(userRole || "").toLowerCase();
                return role === "admin" || role === "reviewer";
              })() && (
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
                    const role = String(userRole || "").toLowerCase();
                    const showFinish = (role === "admin" || role === "reviewer") && m.total > 0 && m.done === m.total;

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
