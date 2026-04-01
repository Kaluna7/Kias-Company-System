// src/app/Page/schedule/page.js
"use client";

import { useCallback, useEffect, useRef, useState, startTransition, Suspense } from "react";
import gsap from "gsap";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/app/contexts/ToastContext";

const BASE_DEPT_ROWS = [
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
];

const DEFAULT_MAIN_SCHEDULE_DATA = [
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
];

function SchedulePageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const currentYear = new Date().getFullYear();
  const yearFromUrl = searchParams.get("year");
  const initialYear = (() => {
    if (!yearFromUrl) return currentYear;
    const parsed = parseInt(yearFromUrl, 10);
    return Number.isNaN(parsed) ? currentYear : parsed;
  })();
  const [selectedYear, setSelectedYear] = useState(initialYear);

  const headerRef = useRef(null);
  const tableRef = useRef(null);
  const feedbackRef = useRef(null);

  const cloneBaseRows = useCallback(() => BASE_DEPT_ROWS.map((r) => ({ 
    ...r, 
    startDate: "", 
    endDate: "", 
    days: null, 
    user: "", 
    saved: false 
  })), []);

  const [sopReviewData, setSopReviewData] = useState(() => cloneBaseRows());
  const [worksheetData, setWorksheetData] = useState(() => cloneBaseRows());
  const [auditFindingData, setAuditFindingData] = useState(() => cloneBaseRows());
  const [evidenceData, setEvidenceData] = useState(() => cloneBaseRows());

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempUser, setTempUser] = useState("");
  const [tempUserId, setTempUserId] = useState("");
  const [selectedModuleKey, setSelectedModuleKey] = useState("sop-review");
  const [users, setUsers] = useState([]);
  const [tempMinDate, setTempMinDate] = useState("");
  const [tempMaxDate, setTempMaxDate] = useState("");
  const [rangeMonth, setRangeMonth] = useState(() => new Date());
  const [userPickerContext, setUserPickerContext] = useState(null); // { moduleKey, department_id } when popup open
  const [tempSelectedUserIds, setTempSelectedUserIds] = useState([]); // multiple user ids for picker
  const [inlineSavingKey, setInlineSavingKey] = useState(""); // `${moduleKey}:${department_id}`
  const [archive, setArchive] = useState({ archivedModules: new Set(), archivedByModule: new Map() });
  const todayIso = new Date().toISOString().split("T")[0];
  const [mainScheduleRows, setMainScheduleRows] = useState([]);
  const [mainScheduleCollapsed, setMainScheduleCollapsed] = useState(false);
  const [mainEditorOpen, setMainEditorOpen] = useState(false);
  const [selectedMainRow, setSelectedMainRow] = useState(null);
  const [mainTempStartDate, setMainTempStartDate] = useState("");
  const [mainTempEndDate, setMainTempEndDate] = useState("");
  const [mainTempInchargeModules, setMainTempInchargeModules] = useState([]);
  const [mainTempModuleDates, setMainTempModuleDates] = useState({}); // { moduleKey: { startDate, endDate } }

  useEffect(() => {
    const raw = searchParams.get("year");
    const cy = new Date().getFullYear();
    if (raw == null || raw === "") {
      setSelectedYear((prev) => (prev !== cy ? cy : prev));
      return;
    }
    const p = parseInt(raw, 10);
    if (Number.isNaN(p)) return;
    setSelectedYear((prev) => (prev !== p ? p : prev));
  }, [searchParams]);

  // ---- Helpers
  const parseDate = useCallback((dateStr) => {
    if (!dateStr) return "";
    const cleaned = String(dateStr).trim();
    // Accept both "06-Jan-25" and "06 Jan 25"
    const parts = cleaned.split(/[-\s]+/).filter(Boolean);
    if (parts.length === 3) {
      const day = String(parts[0] || "").padStart(2, "0");
      const monthMap = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
      const monKey = String(parts[1] || "").slice(0, 3);
      const month = monthMap[monKey] || "01";
      const yy = String(parts[2] || "").slice(-2);
      const year = `20${yy}`;
      return `${year}-${month}-${day}`;
    }
    return "";
  }, []);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  }, []);

  // Load data from API
  const loadModuleSchedule = useCallback(async (moduleKey, setData) => {
    try {
      const yq = selectedYear != null && Number.isFinite(selectedYear) ? `&year=${encodeURIComponent(String(selectedYear))}` : "";
      const res = await fetch(`/api/schedule/module?module=${encodeURIComponent(moduleKey)}${yq}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !Array.isArray(json.rows)) {
        console.log(`loadModuleSchedule(${moduleKey}): No data or error`);
        return;
      }

      console.log(`loadModuleSchedule(${moduleKey}): Loaded ${json.rows.length} rows:`, json.rows.map(r => ({
        department_id: r.department_id,
        is_configured: r.is_configured,
        start_date: r.start_date,
        end_date: r.end_date,
      })));

      setData((prev) =>
        (prev || []).map((item) => {
          const saved = json.rows.find((r) => r.department_id === item.department_id);
          if (!saved) {
            // No saved data - clear default dates
            return {
              ...item,
              startDate: "",
              endDate: "",
              days: null,
              user: "",
              user_id: "",
              saved: false,
            };
          }
          
          // Only show dates if is_configured is true
          const isConfigured = !!saved.is_configured;
          if (item.department_id === "A1.1" && moduleKey === "sop-review") {
            console.log(`loadModuleSchedule: Setting saved=${isConfigured} for ${moduleKey} department_id=${item.department_id}`);
          }
          return {
            ...item,
            startDate: isConfigured && saved.start_date ? formatDate(saved.start_date) : "",
            endDate: isConfigured && saved.end_date ? formatDate(saved.end_date) : "",
            days: isConfigured && saved.days ? saved.days : null,
            user: saved.user_name || "",
            user_id: saved.user_id || "",
            // "saved" means configured by user
            saved: isConfigured,
          };
        })
      );
    } catch (err) {
      console.error(`Error loading schedule module ${moduleKey}:`, err);
    }
  }, [formatDate, selectedYear]);

  const loadAllModuleSchedules = useCallback(async () => {
    await Promise.allSettled([
      loadModuleSchedule("sop-review", setSopReviewData),
      loadModuleSchedule("worksheet", setWorksheetData),
      loadModuleSchedule("audit-finding", setAuditFindingData),
      loadModuleSchedule("evidence", setEvidenceData),
    ]);
  }, [loadModuleSchedule]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users?page=1&pageSize=100", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && Array.isArray(json.users)) {
        // Filter: only include users with role "user", exclude "admin" and "reviewer"
        const filteredUsers = json.users.filter(user => {
          const role = (user.role || "").toLowerCase();
          return role === "user";
        });
        setUsers(filteredUsers);
      } else {
        setUsers([]);
      }
    } catch (e) {
      console.error("Error loading users:", e);
      setUsers([]);
    }
  }, []);

  const loadMainSchedule = useCallback(async () => {
    try {
      const yq = selectedYear != null && Number.isFinite(selectedYear) ? `?year=${encodeURIComponent(String(selectedYear))}` : "";
      const res = await fetch(`/api/schedule/main${yq}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      const rows = res.ok && json?.success && Array.isArray(json.rows) ? json.rows : [];

      console.log("loadMainSchedule: Loaded rows from database:", rows.map(r => ({
        department_name: r.department_name,
        incharge_modules: r.incharge_modules,
        module_dates: r.module_dates,
      })));

      // Merge DB rows into defaults (so UI always shows full list)
      const byName = new Map(
        (rows || []).map((r) => [String(r.department_name || "").toLowerCase(), r])
      );

      const merged = DEFAULT_MAIN_SCHEDULE_DATA.map((d) => {
        const saved = byName.get(String(d.department || "").toLowerCase());
        if (!saved) {
          // No saved data - use default but with empty inchargeModules
          return { 
            ...d, 
            inchargeModules: [], 
            moduleDates: {},
            startDate: "—",
            endDate: "—",
            days: null,
          };
        }

        const inchargeModules = Array.isArray(saved.incharge_modules)
          ? saved.incharge_modules
          : typeof saved.incharge_modules === "string"
            ? (() => { try { return JSON.parse(saved.incharge_modules); } catch { return []; } })()
            : [];
        
        if (d.department === "Finance") {
          console.log("loadMainSchedule: Finance department - inchargeModules:", inchargeModules, "from saved:", saved.incharge_modules);
        }

        const isAll = inchargeModules.includes("all");
        const hasSpecificModules = inchargeModules.length > 0 && !isAll;

        // Parse module_dates from database
        let moduleDates = {};
        if (saved.module_dates) {
          try {
            const parsed = typeof saved.module_dates === "string" 
              ? JSON.parse(saved.module_dates) 
              : saved.module_dates;
            if (parsed && typeof parsed === "object") {
              // Convert ISO dates to formatted dates
              // Only include modules with valid dates (not empty/null)
              for (const [key, value] of Object.entries(parsed)) {
                if (value && typeof value === "object" && value.start_date && value.end_date &&
                    value.start_date !== "" && value.end_date !== "" &&
                    value.start_date !== null && value.end_date !== null) {
                  moduleDates[key] = {
                    startDate: formatDate(value.start_date),
                    endDate: formatDate(value.end_date),
                    start_date: value.start_date,
                    end_date: value.end_date,
                  };
                }
                // If dates are empty/null, don't include in moduleDates (will be removed from DB)
              }
            }
          } catch (e) {
            console.error("Error parsing module_dates:", e);
          }
        }

        // Only show main schedule dates if:
        // 1. "All" is selected (inchargeModules includes "all")
        // 2. "Not Set" is selected but user still set main schedule dates (inchargeModules is empty but start_date/end_date exist)
        // If specific modules are selected, startDate and endDate should be "—" even if start_date/end_date exist in database
        let startDate = "—";
        let endDate = "—";
        let days = null;
        
        if (isAll || (inchargeModules.length === 0 && saved.start_date && saved.end_date)) {
          // Only show dates if "All" is selected or "Not Set" with dates
          startDate = saved.start_date ? formatDate(saved.start_date) : "—";
          endDate = saved.end_date ? formatDate(saved.end_date) : "—";
          if (saved.start_date && saved.end_date) {
            days = saved.days ?? null;
          }
        }
        // If hasSpecificModules, startDate, endDate, and days remain "—" and null
        
        return {
          ...d,
          startDate,
          endDate,
          days,
          inchargeModules: inchargeModules?.length ? inchargeModules : [],
          moduleDates,
        };
      });

      setMainScheduleRows(merged);
    } catch (e) {
      console.error("Error loading main schedule:", e);
      // fallback to defaults
      setMainScheduleRows(DEFAULT_MAIN_SCHEDULE_DATA.map((d) => ({ ...d, inchargeModules: [], moduleDates: {} })));
    }
  }, [formatDate, selectedYear]);

  const loadArchive = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/archive", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !Array.isArray(json.rows)) {
        setArchive({ archivedModules: new Set(), archivedByModule: new Map() });
        return;
      }

      const archivedModules = new Set();
      const archivedByModule = new Map(); // moduleKey -> Set(department_id)
      for (const r of json.rows || []) {
        const moduleKey = String(r.module_key || "").trim();
        if (!moduleKey) continue;
        const scope = String(r.scope || "").trim();
        if (scope === "module") {
          archivedModules.add(moduleKey);
          continue;
        }
        const dep = String(r.department_id || "").trim();
        if (!dep) continue;
        if (!archivedByModule.has(moduleKey)) archivedByModule.set(moduleKey, new Set());
        archivedByModule.get(moduleKey).add(dep);
      }
      setArchive({ archivedModules, archivedByModule });
    } catch (e) {
      console.error("Error loading archive:", e);
      setArchive({ archivedModules: new Set(), archivedByModule: new Map() });
    }
  }, []);

  // ---- Effects
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/Page/auth");
      return;
    }
    if (status === "authenticated") {
      loadUsers();
      loadArchive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadMainSchedule();
    loadAllModuleSchedules();
  }, [status, selectedYear, loadMainSchedule, loadAllModuleSchedules]);

  useEffect(() => {
    const qs =
      selectedYear != null && Number.isFinite(selectedYear)
        ? `?year=${encodeURIComponent(String(selectedYear))}`
        : "";
    router.prefetch(`/Page/dashboard${qs}`);
  }, [router, selectedYear]);

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
  }, []);

  // Reset invalid module dates when main schedule dates change
  // Only validate minimum date (start date) - allow future dates without maximum limit
  useEffect(() => {
    if (!mainEditorOpen || !selectedMainRow) return;
    
    const mainStartIso = mainTempStartDate && mainTempStartDate !== "" && mainTempStartDate !== "—" 
      ? mainTempStartDate 
      : (selectedMainRow?.startDate && selectedMainRow.startDate !== "—" && selectedMainRow.startDate !== ""
        ? parseDate(selectedMainRow.startDate)
        : null);
    
    // Only validate if main schedule has a start date
    // Don't validate against end date - allow future dates
    if (!mainStartIso) return;
    
    // Check each module date and reset if invalid (only check minimum, not maximum)
    let hasInvalidDates = false;
    const updatedModuleDates = { ...mainTempModuleDates };
    
    for (const [moduleKey, modDates] of Object.entries(mainTempModuleDates)) {
      if (!modDates || typeof modDates !== "object") continue;
      
      const startIso = modDates.startDate || "";
      const endIso = modDates.endDate || "";
      
      if (!startIso && !endIso) continue;
      
      let needsReset = false;
      // Only validate that dates are not before main schedule start date
      // Allow dates in the future (no maximum limit)
      if (startIso && mainStartIso && startIso < mainStartIso) needsReset = true;
      if (endIso && mainStartIso && endIso < mainStartIso) needsReset = true;
      
      if (needsReset) {
        updatedModuleDates[moduleKey] = { startDate: "", endDate: "" };
        hasInvalidDates = true;
      }
    }
    
    if (hasInvalidDates) {
      setMainTempModuleDates(updatedModuleDates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTempStartDate, mainEditorOpen]);

  // ---- Early return
  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const isQuarterly = (dept) => dept.includes("Q1") || dept.includes("Q2") || dept.includes("Q3");

  const moduleLabel = (key) =>
    key === "sop-review"
      ? "SOP Review"
      : key === "worksheet"
        ? "Worksheet"
        : key === "audit-finding"
          ? "Audit Finding"
          : key === "evidence"
            ? "Evidence"
            : key;

  const isoToDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const toISO = (d) => {
    if (!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

  const isIsoInRange = (iso, minIso, maxIso) => {
    if (!iso) return false;
    // Only check min/max if they are provided as valid ISO strings
    // Treat empty string, null, or undefined as no restriction
    const validMin = minIso && minIso !== "" && minIso !== null && minIso !== undefined;
    const validMax = maxIso && maxIso !== "" && maxIso !== null && maxIso !== undefined;
    
    if (validMin && iso < minIso) return false;
    if (validMax && iso > maxIso) return false;
    return true;
  };

  const MonthGrid = ({ monthDate, startIso, endIso, minIso, maxIso, onPick }) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const mondayIndex = (first.getDay() + 6) % 7; // Monday=0
    const cells = [];
    for (let i = 0; i < mondayIndex; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    while (cells.length % 7 !== 0) cells.push(null);

    const monthTitle = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="text-sm font-bold text-gray-800">{monthTitle}</div>
        </div>
        <div className="px-3 py-3">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {week.map((w) => (
              <div key={w} className="text-[11px] font-bold text-gray-500 text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, idx) => {
              if (!d) return <div key={idx} className="h-9" />;
              const iso = toISO(d);
              const inRange = isIsoInRange(iso, minIso, maxIso);
              const disabled = !inRange;
              // Debug for first few dates
              if (idx < 10 && d.getDate() <= 10) {
                console.log(`Date ${iso}: inRange=${inRange}, minIso=${minIso}, maxIso=${maxIso}, disabled=${disabled}`);
              }
              const isStart = !!startIso && iso === startIso;
              const isEnd = !!endIso && iso === endIso;
              const inBetween =
                !!startIso && !!endIso && iso > startIso && iso < endIso;
              const isOneDay = isStart && isEnd;

              const base =
                "h-9 w-9 flex items-center justify-center text-sm font-semibold transition-colors";
              const disabledCls = "text-gray-300 cursor-not-allowed";
              const normalCls = "text-gray-700 hover:bg-gray-100 cursor-pointer";
              const betweenCls = inBetween ? "bg-blue-50" : "";
              const startCls = isStart ? "bg-blue-600 text-white" : "";
              const endCls = isEnd ? "bg-blue-600 text-white" : "";

              const rounded =
                isOneDay
                  ? "rounded-full"
                  : isStart
                    ? "rounded-l-full"
                    : isEnd
                      ? "rounded-r-full"
                      : "rounded-full";

              return (
                <button
                  type="button"
                  key={idx}
                  disabled={disabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!disabled) {
                      onPick(iso);
                    }
                  }}
                  onMouseDown={(e) => {
                    // Prevent default to avoid focus issues
                    if (disabled) {
                      e.preventDefault();
                    }
                  }}
                  className={[
                    base,
                    rounded,
                    disabled ? disabledCls : normalCls,
                    betweenCls,
                    startCls,
                    endCls,
                  ].join(" ")}
                  title={iso}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const RangePicker = ({ startIso, endIso, minIso, maxIso, onChange, onReset }) => {
    // Determine initial month to display
    // Priority: 1) startIso, 2) minIso, 3) current date
    const getInitialMonth = () => {
      if (startIso && startIso !== "" && startIso !== null && startIso !== undefined) {
        return new Date(startIso);
      }
      if (minIso && minIso !== "" && minIso !== null && minIso !== undefined) {
        return new Date(minIso);
      }
      return new Date();
    };
    
    const [localRangeMonth, setLocalRangeMonth] = useState(() => getInitialMonth());
    
    // Update local range month when minIso or startIso changes
    useEffect(() => {
      // Only use startIso if it's a valid non-empty string
      if (startIso && startIso !== "" && startIso !== null && startIso !== undefined) {
        setLocalRangeMonth(new Date(startIso));
      } else if (minIso && minIso !== "" && minIso !== null && minIso !== undefined) {
        setLocalRangeMonth(new Date(minIso));
      } else {
        // If both are null/empty (reset state), go back to current date
        setLocalRangeMonth(new Date());
      }
    }, [startIso, minIso]);
    
    const handlePick = (iso) => {
      const inRange = isIsoInRange(iso, minIso, maxIso);
      if (!inRange) {
        return;
      }
      // If no start date, or both start and end are set, start fresh
      if (!startIso || (startIso && endIso)) {
        console.log("Setting new start date:", iso);
        onChange({ start: iso, end: "" });
        return;
      }
      // start exists and end not set
      if (iso < startIso) {
        console.log("New date before start, resetting:", iso);
        onChange({ start: iso, end: "" });
        return;
      }
      // Set end date
      console.log("Setting end date:", iso);
      onChange({ start: startIso, end: iso });
    };

    // Always show two months for better date range selection
    const leftMonth = startOfMonth(localRangeMonth);
    const showTwoMonths = true;

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-xs font-bold text-gray-600">Selected range</div>
            <div className="text-sm font-semibold text-gray-900">
              {startIso ? formatDate(startIso) : "—"}{" "}
              <span className="text-gray-400 font-bold">→</span>{" "}
              {endIso ? formatDate(endIso) : "—"}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-gray-100 text-gray-800 text-xs font-bold hover:bg-gray-200"
              onClick={() => {
                onChange({ start: "", end: "" });
                // Reset to current month when resetting dates
                setLocalRangeMonth(new Date());
                if (onReset) onReset();
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {showTwoMonths && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLocalRangeMonth((m) => addMonths(m, -1));
              }}
            >
              ← Prev
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLocalRangeMonth((m) => addMonths(m, 1));
              }}
            >
              Next →
            </button>
          </div>
        )}

        <div className={`grid grid-cols-1 ${showTwoMonths ? "md:grid-cols-2" : ""} gap-3`}>
          <MonthGrid
            monthDate={leftMonth}
            startIso={startIso}
            endIso={endIso}
            minIso={minIso}
            maxIso={maxIso}
            onPick={handlePick}
          />
          {showTwoMonths && (
            <MonthGrid
              monthDate={startOfMonth(addMonths(localRangeMonth, 1))}
              startIso={startIso}
              endIso={endIso}
              minIso={minIso}
              maxIso={maxIso}
              onPick={handlePick}
            />
          )}
        </div>
      </div>
    );
  };

  const buildPickerKey = (moduleKey, row) => `${moduleKey}:${row?.department_id ?? ""}`;

  const getModuleRows = (moduleKey) => {
    switch (moduleKey) {
      case "sop-review": return sopReviewData;
      case "worksheet": return worksheetData;
      case "audit-finding": return auditFindingData;
      case "evidence": return evidenceData;
      default: return [];
    }
  };

  // Delete/reset module schedule data
  const deleteModuleSchedule = async (moduleKey, departmentId) => {
    if (!moduleKey || !departmentId) return { ok: false, error: "Missing required fields" };
    
    try {
      const res = await fetch("/api/schedule/module", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_key: moduleKey,
          department_id: departmentId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        return { ok: false, error: json?.error || `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (e) {
      console.error("Error deleting module schedule:", e);
      return { ok: false, error: e?.message || String(e) };
    }
  };

  const saveModuleRow = async (moduleKey, row, overrides = {}) => {
    const startIso = overrides.start_date || parseDate(row?.startDate);
    const endIso = overrides.end_date || parseDate(row?.endDate);
    const userId = overrides.user_id ?? row?.user_id ?? null;
    const userName = overrides.user_name ?? row?.user ?? "";

    if (!moduleKey || !row?.department_id || !startIso || !endIso) {
      console.error("saveModuleRow: Missing required fields", { moduleKey, department_id: row?.department_id, startIso, endIso });
      return { ok: false, error: "Missing required fields" };
    }

    console.log("saveModuleRow: Saving", {
      moduleKey,
      department_id: row.department_id,
      department_name: row.department,
      start_date: startIso,
      end_date: endIso,
      user_id: userId,
      user_name: userName,
    });

    const res = await fetch("/api/schedule/module", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module_key: moduleKey,
        department_id: row.department_id,
        department_name: row.department,
        user_id: userId || null,
        user_name: userName || null,
        start_date: startIso,
        end_date: endIso,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      console.error("saveModuleRow: Failed to save", { error: json?.error || `HTTP ${res.status}` });
      return { ok: false, error: json?.error || `HTTP ${res.status}` };
    }
    console.log("saveModuleRow: Successfully saved", { 
      moduleKey, 
      department_id: row.department_id,
      is_configured: json?.row?.is_configured,
    });
    return { ok: true, row: json?.row ?? null };
  };

  const updateModuleRowState = (moduleKey, departmentId, patch) => {
    const apply = (rows) =>
      (rows || []).map((r) => (r.department_id === departmentId ? { ...r, ...patch } : r));

    if (moduleKey === "sop-review") setSopReviewData(apply);
    else if (moduleKey === "worksheet") setWorksheetData(apply);
    else if (moduleKey === "audit-finding") setAuditFindingData(apply);
    else if (moduleKey === "evidence") setEvidenceData(apply);
  };

  const getMainScheduleBoundsForSecDept = (secDeptName, moduleKey = null) => {
    const name = String(secDeptName || "").toLowerCase();
    const pick = (key) => (mainScheduleRows?.length ? mainScheduleRows : DEFAULT_MAIN_SCHEDULE_DATA).find(
      (r) => String(r.department || "").toLowerCase() === key
    );

    // Map "Sec. X" to main schedule department rows
    let main = null;
    if (name.includes("finance")) main = pick("finance");
    else if (name.includes("accounting")) main = pick("accounting");
    else if (name.includes("human resources") || name.includes("hrd")) main = pick("human resources (hrd)");
    else if (name.includes("general affair") || name.includes("(ga)")) main = pick("general affair (ga)");
    else if (name.includes("store design") || name.includes("sdp")) main = pick("store design & planner (sdp)");
    else if (name.includes("tax")) main = pick("tax");
    else if (name.includes("l&p") || name.includes("security")) main = pick("security (l&p)");
    else if (name.includes("mis")) main = pick("mis");
    else if (name.includes("merchandise")) main = pick("merchandise");
    else if (name.includes("operational")) main = pick("operational");
    else if (name.includes("warehouse")) main = pick("warehouse");

    if (!main) return { min: "", max: "" };
    
    // If moduleKey is provided and main schedule has module_dates for this module, use those dates
    // Only if the module is currently selected as incharge for this department.
    if (
      moduleKey &&
      Array.isArray(main.inchargeModules) &&
      main.inchargeModules.includes(moduleKey) &&
      main.moduleDates &&
      main.moduleDates[moduleKey]
    ) {
      const moduleDates = main.moduleDates[moduleKey];
      // moduleDates can have startDate/endDate (formatted) or start_date/end_date (ISO)
      const startIso = moduleDates.start_date || parseDate(moduleDates.startDate || "");
      const endIso = moduleDates.end_date || parseDate(moduleDates.endDate || "");
      // Only use if both dates are valid and not empty (not reset)
      // If dates are empty/invalid, don't set constraints (allow any date)
      if (startIso && endIso && startIso !== "" && endIso !== "") {
        return { min: startIso, max: endIso };
      }
      // If dates are empty/invalid, return empty constraints (no restrictions)
    }
    
    // Fallback to main schedule dates (for "All" case or when module_dates not available)
    // Only use if main schedule dates are not "—"
    if (main.startDate && main.startDate !== "—" && main.endDate && main.endDate !== "—") {
      return { min: parseDate(main.startDate), max: parseDate(main.endDate) };
    }
    
    return { min: "", max: "" };
  };

  const getMainDeptNameForSecDept = (secDeptName) => {
    const name = String(secDeptName || "").toLowerCase();
    if (name.includes("finance")) return "Finance";
    if (name.includes("accounting")) return "Accounting";
    if (name.includes("human resources") || name.includes("hrd")) return "Human Resources (HRD)";
    if (name.includes("general affair") || name.includes("(ga)")) return "General Affair (GA)";
    if (name.includes("store design") || name.includes("sdp")) return "Store Design & Planner (SDP)";
    if (name.includes("tax")) return "Tax";
    if (name.includes("l&p") || name.includes("security")) return "Security (L&P)";
    if (name.includes("mis")) return "MIS";
    if (name.includes("merchandise")) return "Merchandise";
    if (name.includes("operational")) return "Operational";
    if (name.includes("warehouse")) return "Warehouse";
    return "";
  };

  const getMainScheduleModulesForSecDept = (secDeptName) => {
    const name = String(secDeptName || "").toLowerCase();
    const pick = (key) => (mainScheduleRows?.length ? mainScheduleRows : DEFAULT_MAIN_SCHEDULE_DATA).find(
      (r) => String(r.department || "").toLowerCase() === key
    );

    let main = null;
    if (name.includes("finance")) main = pick("finance");
    else if (name.includes("accounting")) main = pick("accounting");
    else if (name.includes("human resources") || name.includes("hrd")) main = pick("human resources (hrd)");
    else if (name.includes("general affair") || name.includes("(ga)")) main = pick("general affair (ga)");
    else if (name.includes("store design") || name.includes("sdp")) main = pick("store design & planner (sdp)");
    else if (name.includes("tax")) main = pick("tax");
    else if (name.includes("l&p") || name.includes("security")) main = pick("security (l&p)");
    else if (name.includes("mis")) main = pick("mis");
    else if (name.includes("merchandise")) main = pick("merchandise");
    else if (name.includes("operational")) main = pick("operational");
    else if (name.includes("warehouse")) main = pick("warehouse");

    const mods = Array.isArray(main?.inchargeModules) && main.inchargeModules.length > 0 ? main.inchargeModules : [];
    if (name.includes("finance") && mods.length > 0) {
      console.log(`getMainScheduleModulesForSecDept(${secDeptName}): found main schedule with inchargeModules:`, mods);
    }
    return mods;
  };

  const isDeptEnabledForModule = (moduleKey, secDeptName) => {
    // First check if module schedule already exists (saved) for this dept
    // This takes priority because if module is already configured, it should always be visible
    const mainDeptName = getMainDeptNameForSecDept(secDeptName);
    const isSaved = mainDeptName && isModuleSavedForMainDept(moduleKey, mainDeptName);
    if (isSaved) {
      if (secDeptName.includes("Finance") && moduleKey === "sop-review") {
        console.log(`isDeptEnabledForModule: ${moduleKey} for ${secDeptName} enabled because module is saved`);
      }
      return true;
    }
    
    const mods = getMainScheduleModulesForSecDept(secDeptName);
    
    // If "Not Set" (empty array), department should not appear in module schedules
    if (!mods || mods.length === 0) {
      if (secDeptName.includes("Finance") && moduleKey === "sop-review") {
        console.log(`isDeptEnabledForModule: ${moduleKey} for ${secDeptName} disabled (no modules)`);
      }
      return false;
    }
    
    // Check if "all" is selected or specific module is in the list
    if (mods.includes("all")) {
      if (secDeptName.includes("Finance") && moduleKey === "sop-review") {
        console.log(`isDeptEnabledForModule: ${moduleKey} for ${secDeptName} enabled (all)`);
      }
      return true;
    }
    if (mods.includes(moduleKey)) {
      if (secDeptName.includes("Finance") && moduleKey === "sop-review") {
        console.log(`isDeptEnabledForModule: ${moduleKey} for ${secDeptName} enabled (module in list: ${mods.join(", ")})`);
      }
      return true;
    }
    
    if (secDeptName.includes("Finance") && moduleKey === "sop-review") {
      console.log(`isDeptEnabledForModule: ${moduleKey} for ${secDeptName} disabled (module not in list: ${mods.join(", ")})`);
    }
    return false;
  };

  const MAIN_MODULES = [
    { key: "sop-review", label: "SOP Review" },
    { key: "worksheet", label: "Worksheet" },
    { key: "audit-finding", label: "Audit Finding" },
    { key: "evidence", label: "Evidence" },
  ];

  const getScheduleIdForMainDept = (mainDeptName) => {
    const deptKey = MAIN_DEPT_KEY_BY_MAIN_NAME(mainDeptName);
    return SCHEDULE_ID_BY_DEPT_KEY[deptKey] || "";
  };

  const getModuleStateRow = (moduleKey, departmentId) => {
    const pick = (rows) => (rows || []).find((r) => String(r.department_id) === String(departmentId)) || null;
    if (!departmentId) return null;
    if (moduleKey === "sop-review") return pick(sopReviewData);
    if (moduleKey === "worksheet") return pick(worksheetData);
    if (moduleKey === "audit-finding") return pick(auditFindingData);
    if (moduleKey === "evidence") return pick(evidenceData);
    return null;
  };

  const MAIN_DEPT_KEY_BY_MAIN_NAME = (mainDeptName) => {
    const name = String(mainDeptName || "").toLowerCase();
    if (name.includes("finance")) return "finance";
    if (name.includes("accounting")) return "accounting";
    if (name.includes("human resources") || name.includes("hrd")) return "hrd";
    if (name.includes("general affair") || name.includes("(ga)")) return "g&a";
    if (name.includes("store design") || name.includes("planner") || name.includes("sdp")) return "sdp";
    if (name.includes("tax")) return "tax";
    if (name.includes("security") || name.includes("l&p")) return "l&p";
    if (name.includes("mis")) return "mis";
    if (name.includes("merchandise")) return "merch";
    if (name.includes("operational")) return "ops";
    if (name.includes("warehouse")) return "whs";
    return "";
  };

  const SCHEDULE_ID_BY_DEPT_KEY = {
    finance: "A1.1",
    accounting: "A1.2",
    hrd: "A1.3",
    "g&a": "A1.4",
    sdp: "A1.5",
    tax: "A1.6",
    "l&p": "A1.7",
    mis: "A1.8",
    merch: "A1.9",
    ops: "A1.10",
    whs: "A1.11",
  };

  const isModuleSavedForMainDept = (moduleKey, mainDeptName) => {
    const deptKey = MAIN_DEPT_KEY_BY_MAIN_NAME(mainDeptName);
    const scheduleId = SCHEDULE_ID_BY_DEPT_KEY[deptKey];
    if (!scheduleId) return false;
    
    const pick = (rows) => {
      if (!rows || !Array.isArray(rows)) return null;
      return rows.find((r) => String(r.department_id) === String(scheduleId));
    };
    
    const row =
      moduleKey === "sop-review"
        ? pick(sopReviewData)
        : moduleKey === "worksheet"
          ? pick(worksheetData)
          : moduleKey === "audit-finding"
            ? pick(auditFindingData)
            : moduleKey === "evidence"
              ? pick(evidenceData)
              : null;
    
    // If no row found, module is not saved
    if (!row) return false;
    
    // Check if module has saved data
    // Priority: 1) saved flag (is_configured), 2) has valid dates
    if (row.saved !== undefined) {
      return !!row.saved;
    }
    
    // Otherwise check if it has configured dates (not default empty dates)
    const hasDates = row.startDate && row.endDate && 
                     row.startDate !== "—" && row.endDate !== "—" &&
                     String(row.startDate).trim() !== "" && String(row.endDate).trim() !== "" &&
                     row.startDate !== row.endDate; // Make sure dates are different (not placeholder)
    
    return hasDates;
  };


  const handleMainEditorOpen = (row, e) => {
    // Prevent event bubbling to avoid triggering other handlers
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Close datePickerOpen if it's open to avoid conflicts
    if (datePickerOpen) {
      setDatePickerOpen(false);
    }
    
    setSelectedMainRow(row);
    // Only parse if startDate/endDate are valid (not "—" or empty)
    // If dates are "—" or empty, set to empty string (not null) to allow reset
    const startDateParsed = row.startDate && row.startDate !== "—" && row.startDate !== "" 
      ? parseDate(row.startDate) 
      : "";
    const endDateParsed = row.endDate && row.endDate !== "—" && row.endDate !== "" 
      ? parseDate(row.endDate) 
      : "";
    setMainTempStartDate(startDateParsed);
    setMainTempEndDate(endDateParsed);
    const existingMods =
      Array.isArray(row.inchargeModules) && row.inchargeModules.length > 0 ? row.inchargeModules : [];
    setMainTempInchargeModules(existingMods);
    
    // Initialize module dates from row data
    // Only load if they are valid and within main schedule range (if main schedule has dates)
    const moduleDates = {};
    const mainStartIso = startDateParsed && startDateParsed !== "" ? startDateParsed : null;
    const mainEndIso = endDateParsed && endDateParsed !== "" ? endDateParsed : null;
    
    if (row.moduleDates && typeof row.moduleDates === "object") {
      for (const [key, value] of Object.entries(row.moduleDates)) {
        if (value && typeof value === "object") {
          // value.startDate is formatted date, value.start_date is ISO
          const startIso = value.start_date || parseDate(value.startDate || "");
          const endIso = value.end_date || parseDate(value.endDate || "");
          
          // Only include if both dates are valid
          if (startIso && endIso && startIso !== "" && endIso !== "") {
            // If main schedule has dates, validate module dates are within range
            let isValid = true;
            if (mainStartIso && startIso < mainStartIso) isValid = false;
            if (mainEndIso && endIso > mainEndIso) isValid = false;
            if (mainStartIso && endIso < mainStartIso) isValid = false;
            if (mainEndIso && startIso > mainEndIso) isValid = false;
            
            // Only add if valid (or if main schedule has no dates)
            if (isValid || (!mainStartIso && !mainEndIso)) {
              moduleDates[key] = {
                startDate: startIso,
                endDate: endIso,
              };
            }
          }
        }
      }
    }
    setMainTempModuleDates(moduleDates);
    
    setMainEditorOpen(true);
  };

  const handleMainScheduleDelete = async () => {
    if (!selectedMainRow) return;
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the schedule for ${selectedMainRow.department}?`)) {
      return;
    }

    try {
      const deptId = getScheduleIdForMainDept(selectedMainRow.department);
      
      // Delete main schedule
      const res = await fetch("/api/schedule/main", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_name: selectedMainRow.department,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show("Failed to delete main schedule: " + (json?.error || `HTTP ${res.status}`), "error");
        return;
      }

      // Delete all related module schedules for this department
      if (deptId) {
        const moduleKeys = ["sop-review", "worksheet", "audit-finding", "evidence"];
        const deleteResults = await Promise.allSettled(
          moduleKeys.map((moduleKey) => deleteModuleSchedule(moduleKey, deptId))
        );
        
        // Log errors but don't fail the operation
        deleteResults.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(`Failed to delete module ${moduleKeys[index]}:`, result.reason);
          } else if (result.value && !result.value.ok) {
            console.error(`Failed to delete module ${moduleKeys[index]}:`, result.value.error);
          }
        });
        
        // Reload module schedules
        await loadAllModuleSchedules();
      }

      // Reload main schedule from database
      await loadMainSchedule();
      
      setMainEditorOpen(false);
      toast.show("Schedule deleted successfully.", "success");
    } catch (e) {
      console.error("Error deleting main schedule:", e);
      toast.show("Error deleting schedule: " + (e?.message || String(e)), "error");
    }
  };

  const handleMainEditorSave = async () => {
    if (!selectedMainRow) return;
    
    const isAll = mainTempInchargeModules.includes("all");
    const hasModules = mainTempInchargeModules.length > 0 && !isAll;
    
    // If no modules selected (not set), allow saving with empty incharge_modules
    if (mainTempInchargeModules.length === 0) {
      // Allow saving with empty incharge_modules (not set state)
      // Still validate main dates as they are required
      if (!mainTempStartDate || !mainTempEndDate) {
        toast.show("Please select a start and end date.", "error");
        return;
      }
      if (new Date(mainTempStartDate) > new Date(mainTempEndDate)) {
        toast.show("Start date cannot be after the end date.", "error");
        return;
      }
    } else if (isAll) {
      // Validate main dates (used when "All" is selected)
      if (!mainTempStartDate || !mainTempEndDate) {
        toast.show("Please select a start and end date.", "error");
        return;
      }
      if (new Date(mainTempStartDate) > new Date(mainTempEndDate)) {
        toast.show("Start date cannot be after the end date.", "error");
        return;
      }
    } else if (hasModules) {
      // If specific modules selected, validate each module's dates
      // But allow empty dates (user can reset dates to remove them)
      const moduleKeys = mainTempInchargeModules.filter((m) => m !== "all");
      for (const moduleKey of moduleKeys) {
        const modDates = mainTempModuleDates[moduleKey];
        // Only validate if dates are provided (not empty)
        // Empty dates are allowed (will be removed from database)
        if (modDates && modDates.startDate && modDates.endDate && 
            modDates.startDate !== "" && modDates.endDate !== "") {
          if (new Date(modDates.startDate) > new Date(modDates.endDate)) {
            const moduleLabel = MAIN_MODULES.find((m) => m.key === moduleKey)?.label || moduleKey;
            toast.show(`${moduleLabel}: Start date cannot be after the end date.`, "error");
            return;
          }
        }
        // If dates are empty, skip validation (will be removed from DB)
      }
    }

    try {
      // Only set start_date and end_date if:
      // 1. "All" is selected (main schedule dates are used)
      // 2. "Not Set" is selected but user still set main schedule dates (for backward compatibility)
      // If specific modules are selected, start_date and end_date should be null
      // because dates are set per module, not in main schedule
      let startDateISO = null;
      let endDateISO = null;
      
      if (isAll || (mainTempInchargeModules.length === 0 && mainTempStartDate && mainTempEndDate)) {
        // Only set main schedule dates if "All" is selected or "Not Set" with dates
        // If dates are empty (reset), set to null to remove from database
        startDateISO = (mainTempStartDate && mainTempStartDate !== "") 
          ? new Date(mainTempStartDate).toISOString().split("T")[0] 
          : null;
        endDateISO = (mainTempEndDate && mainTempEndDate !== "") 
          ? new Date(mainTempEndDate).toISOString().split("T")[0] 
          : null;
      }
      // If hasModules (specific modules selected), startDateISO and endDateISO remain null

      // Build module_dates object
      // Only include modules that have valid dates (not empty)
      // If dates are empty, they will be removed from database
      const moduleDatesToSave = {};
      if (hasModules) {
        // If specific modules are selected (not "All"), use module-specific dates
        for (const moduleKey of mainTempInchargeModules.filter((m) => m !== "all")) {
          const modDates = mainTempModuleDates[moduleKey];
          // Only save if dates are valid and not empty
          if (modDates && modDates.startDate && modDates.endDate && 
              modDates.startDate !== "" && modDates.endDate !== "") {
            moduleDatesToSave[moduleKey] = {
              start_date: new Date(modDates.startDate).toISOString().split("T")[0],
              end_date: new Date(modDates.endDate).toISOString().split("T")[0],
            };
          }
          // If dates are empty, don't include in moduleDatesToSave (will be removed from DB)
        }
      } else if (isAll && startDateISO && endDateISO) {
        // If "All" is selected, sync main schedule dates to all modules
        // This ensures that when "All" is selected, all modules get the same dates
        for (const moduleKey of MAIN_MODULES.map((m) => m.key)) {
          moduleDatesToSave[moduleKey] = {
            start_date: startDateISO,
            end_date: endDateISO,
          };
        }
      }

      const res = await fetch("/api/schedule/main", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_name: selectedMainRow.department,
          incharge_modules: mainTempInchargeModules,
          start_date: startDateISO,
          end_date: endDateISO,
          module_dates: moduleDatesToSave,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show("Failed to save main schedule: " + (json?.error || `HTTP ${res.status}`), "error");
        return;
      }

      // Get department ID for syncing module schedules
      const deptId = getScheduleIdForMainDept(selectedMainRow.department);

      // Sync module_dates from main schedule to schedule_module_feedback
      // This ensures that when dates are set in main schedule, they also appear in module schedule
      // Sync if: 1) specific modules selected with dates, OR 2) "All" selected with main dates
      if (Object.keys(moduleDatesToSave).length > 0 && deptId) {
        console.log("Syncing module dates to schedule_module_feedback:", {
          department: selectedMainRow.department,
          deptId,
          moduleDatesToSave,
        });
        
        const syncResults = await Promise.allSettled(
          Object.entries(moduleDatesToSave).map(([moduleKey, dates]) => {
            // Get the module schedule row to preserve user_id/user_name if they exist
            const moduleRow = getModuleStateRow(moduleKey, deptId);
            console.log(`Syncing ${moduleKey} for ${selectedMainRow.department}:`, {
              department_id: deptId,
              start_date: dates.start_date,
              end_date: dates.end_date,
            });
            return saveModuleRow(
              moduleKey,
              {
                department_id: deptId,
                department: selectedMainRow.department,
                user_id: moduleRow?.user_id || null,
                user: moduleRow?.user || "",
              },
              {
                start_date: dates.start_date,
                end_date: dates.end_date,
              }
            );
          })
        );
        
        // Check for errors (but don't fail the whole operation)
        syncResults.forEach((result, index) => {
          const moduleKey = Object.keys(moduleDatesToSave)[index];
          if (result.status === "rejected") {
            console.error(`Failed to sync module ${moduleKey}:`, result.reason);
          } else if (result.value && !result.value.ok) {
            console.error(`Failed to sync module ${moduleKey}:`, result.value.error);
          } else {
            console.log(`Successfully synced module ${moduleKey}`);
          }
        });
      }

      // Compare old and new module_dates to detect removed modules or dates
      // Only reset module schedule if:
      // 1. Module is removed from incharge_modules (not just dates changed)
      // 2. Module dates are completely removed (not just changed)
      const oldInchargeModules = selectedMainRow?.inchargeModules || [];
      const oldModuleDates = selectedMainRow?.moduleDates || {};
      
      // Check if incharge_modules changed - if module was removed from incharge_modules, reset it
      const removedFromIncharge = oldInchargeModules.filter(
        (m) => m !== "all" && !mainTempInchargeModules.includes(m)
      );
      
      // Check if module dates were completely removed (not just changed)
      // A module date is "removed" if:
      // - It was in oldModuleDates but not in newModuleDates (moduleDatesToSave)
      // - OR it was in oldModuleDates but now has empty dates in newModuleDates
      // - OR user explicitly cleared dates in mainTempModuleDates
      const modulesWithRemovedDates = Object.keys(oldModuleDates).filter((key) => {
        // If module is no longer in incharge_modules, it's removed
        if (!mainTempInchargeModules.includes(key)) {
          return true;
        }
        // Check if dates are missing/empty in newModuleDates (moduleDatesToSave)
        // If moduleDatesToSave doesn't have this key, it means dates were reset/removed
        const newDates = moduleDatesToSave[key];
        if (!newDates || !newDates.start_date || !newDates.end_date) {
          // Also check if dates were explicitly cleared in mainTempModuleDates
          const tempDates = mainTempModuleDates[key];
          // If tempDates is missing, empty, or has empty startDate/endDate, it's removed
          if (!tempDates || !tempDates.startDate || !tempDates.endDate || 
              tempDates.startDate === "" || tempDates.endDate === "") {
            return true;
          }
        }
        return false;
      });
      
      // Also check if any module in mainTempInchargeModules has empty dates in mainTempModuleDates
      // This handles the case where user resets dates for a module that's still in incharge_modules
      const modulesWithEmptyDates = mainTempInchargeModules.filter((key) => {
        if (key === "all") return false;
        const tempDates = mainTempModuleDates[key];
        // If module is in incharge_modules but has empty dates, it should be reset
        if (!tempDates || !tempDates.startDate || !tempDates.endDate || 
            tempDates.startDate === "" || tempDates.endDate === "") {
          // Only reset if it was previously configured (had dates in oldModuleDates)
          return oldModuleDates[key] !== undefined;
        }
        return false;
      });
      
      // Combine all modules that need to be reset
      const allModulesToReset = [...new Set([...removedFromIncharge, ...modulesWithRemovedDates, ...modulesWithEmptyDates])];
      
      console.log("Module reset check:", {
        department: selectedMainRow.department,
        oldInchargeModules,
        newInchargeModules: mainTempInchargeModules,
        removedFromIncharge,
        oldModuleDates: Object.keys(oldModuleDates),
        newModuleDates: Object.keys(moduleDatesToSave),
        modulesWithRemovedDates,
        modulesWithEmptyDates,
        allModulesToReset,
      });
      
      // Delete/reset module schedule ONLY for removed modules or modules with removed dates
      // Do NOT reset if user just changed the dates (dates still exist, just different values)
      if (deptId && allModulesToReset.length > 0) {
        console.log("Resetting module schedules for:", allModulesToReset, "deptId:", deptId);
        const results = await Promise.allSettled(
          allModulesToReset.map((moduleKey) => deleteModuleSchedule(moduleKey, deptId))
        );
        
        // Check for errors
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(`Failed to reset ${allModulesToReset[index]}:`, result.reason);
          } else if (result.value && !result.value.ok) {
            console.error(`Failed to reset ${allModulesToReset[index]}:`, result.value.error);
          }
        });
        
        // Reload module schedules to reflect changes
        await loadAllModuleSchedules();
      }

      // Update local state
      const updated = (mainScheduleRows?.length ? mainScheduleRows : DEFAULT_MAIN_SCHEDULE_DATA).map((r) => {
        if (String(r.department) !== String(selectedMainRow.department)) return r;
        
        // Only set main schedule dates if "All" is selected or "Not Set" with dates
        // If specific modules are selected, main schedule dates should be null/empty
        let startDate = "—";
        let endDate = "—";
        let days = null;
        
        if (isAll || (mainTempInchargeModules.length === 0 && mainTempStartDate && mainTempEndDate)) {
          // Only show dates if they are not empty (not reset)
          startDate = (mainTempStartDate && mainTempStartDate !== "") ? formatDate(mainTempStartDate) : "—";
          endDate = (mainTempEndDate && mainTempEndDate !== "") ? formatDate(mainTempEndDate) : "—";
          if (mainTempStartDate && mainTempEndDate && mainTempStartDate !== "" && mainTempEndDate !== "") {
            days = Math.ceil((new Date(mainTempEndDate) - new Date(mainTempStartDate)) / (1000 * 60 * 60 * 24)) + 1;
          } else {
            days = null;
          }
        }
        
        // Build moduleDates for state
        // Only include modules with valid dates (not empty/reset)
        const moduleDates = {};
        if (hasModules) {
          for (const [key, value] of Object.entries(mainTempModuleDates)) {
            // Only include if dates are valid and not empty
            if (value && value.startDate && value.endDate && 
                value.startDate !== "" && value.endDate !== "") {
              moduleDates[key] = {
                startDate: formatDate(value.startDate),
                endDate: formatDate(value.endDate),
                start_date: new Date(value.startDate).toISOString().split("T")[0],
                end_date: new Date(value.endDate).toISOString().split("T")[0],
              };
            }
            // If dates are empty, don't include in moduleDates (will be removed from DB)
          }
        }
        
        return {
          ...r,
          startDate,
          endDate,
          days,
          inchargeModules: mainTempInchargeModules.length > 0 ? mainTempInchargeModules : [],
          moduleDates,
        };
      });
      // Update local state immediately with the saved data
      // This ensures UI updates immediately without waiting for database reload
      console.log("Setting mainScheduleRows with updated data:", updated.find(r => r.department === selectedMainRow.department));
      setMainScheduleRows(updated);
      
      // Close editor first to prevent any race conditions
      setMainEditorOpen(false);
      
      // Small delay to ensure state is updated before reloading
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Reload main schedule from database to ensure state is in sync
      // This must be done BEFORE reloading module schedules so that isDeptEnabledForModule works correctly
      console.log("Reloading main schedule from database...");
      await loadMainSchedule();
      
      // Small delay to ensure main schedule state is updated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log("Main schedule reloaded");
      
      // Reload module schedules to reflect synced data (after main schedule is updated)
      // This ensures that isDeptEnabledForModule can correctly check if module is enabled
      // Note: isDeptEnabledForModule will check isModuleSavedForMainDept which reads from module schedule state
      // So we need to reload module schedules first, then the component will re-render with updated state
      console.log("Reloading module schedules from database...");
      await loadAllModuleSchedules();
      console.log("Module schedules reloaded");
      
      toast.show("Main schedule saved successfully.", "success");
    } catch (e) {
      console.error("Error saving main schedule:", e);
      toast.show("Error saving main schedule: " + (e?.message || String(e)), "error");
    }
  };

  const handleDatePickerOpen = (moduleKey, row, e) => {
    // Prevent event bubbling to avoid triggering other handlers
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Close mainEditorOpen if it's open to avoid conflicts
    if (mainEditorOpen) {
      setMainEditorOpen(false);
    }
    
    setSelectedRow(row);
    setSelectedModuleKey(moduleKey);
    // Pass moduleKey to getMainScheduleBoundsForSecDept to get module-specific dates
    const bounds = getMainScheduleBoundsForSecDept(row.department, moduleKey);
    setTempMinDate(bounds.min || "");
    setTempMaxDate(bounds.max || "");
    
    // Only use row.startDate/endDate if they are valid and within bounds
    // If main schedule dates are reset (no bounds), don't use module schedule dates
    // This ensures calendar goes back to current date when main schedule is reset
    let initialStartDate = "";
    let initialEndDate = "";
    
    if (bounds.min && bounds.max) {
      // Main schedule has dates - use module schedule dates if valid
      const rowStartIso = parseDate(row.startDate);
      const rowEndIso = parseDate(row.endDate);
      if (rowStartIso && rowEndIso && 
          rowStartIso >= bounds.min && rowEndIso <= bounds.max) {
        initialStartDate = rowStartIso;
        initialEndDate = rowEndIso;
      }
    } else {
      // Main schedule dates are reset - don't use module schedule dates
      // Calendar will show current date
      initialStartDate = "";
      initialEndDate = "";
    }
    
    setTempStartDate(initialStartDate);
    setTempEndDate(initialEndDate);
    setTempUser(row.user || "");
    setTempUserId(row.user_id || "");
    
    // Determine initial month: use startDate if available, otherwise use minIso, otherwise current date
    const baseIso = initialStartDate || bounds.min || "";
    const base = isoToDate(baseIso) || new Date();
    setRangeMonth(startOfMonth(base));
    setDatePickerOpen(true);
  };

  const handleDatePickerSave = async () => {
    if (!tempStartDate || !tempEndDate) {
      toast.show("Please select a start and end date.", "error");
      return;
    }
    if (new Date(tempStartDate) > new Date(tempEndDate)) {
      toast.show("Start date cannot be after the end date.", "error");
      return;
    }
    // Enforce Main Schedule bounds: sub-schedule cannot exceed main schedule dates
    if (tempMinDate && tempStartDate < tempMinDate) {
      toast.show(`Start Date must be on/after ${tempMinDate}`, "error");
      return;
    }
    if (tempMaxDate && tempEndDate > tempMaxDate) {
      toast.show(`End Date must be on/before ${tempMaxDate}`, "error");
      return;
    }

    try {
      const startDateISO = new Date(tempStartDate).toISOString().split("T")[0];
      const endDateISO = new Date(tempEndDate).toISOString().split("T")[0];

      const data = await saveModuleRow(selectedModuleKey, selectedRow, {
        start_date: startDateISO,
        end_date: endDateISO,
        user_id: tempUserId || null,
        user_name: tempUser || null,
      });

      if (data.ok) {
        const days = Math.ceil((new Date(tempEndDate) - new Date(tempStartDate)) / (1000 * 60 * 60 * 24)) + 1;
        updateModuleRowState(selectedModuleKey, selectedRow.department_id, {
          startDate: formatDate(tempStartDate),
          endDate: formatDate(tempEndDate),
          days,
          user: tempUser,
          user_id: tempUserId,
          saved: true,
        });

        setDatePickerOpen(false);
        toast.show("Saved successfully.", "success");
      } else {
        toast.show("Failed to save data: " + (data.error || "Unknown error"), "error");
      }
    } catch (err) {
      console.error("Error saving schedule:", err);
      toast.show("Error saving data: " + err.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                const qs =
                  selectedYear != null && Number.isFinite(selectedYear)
                    ? `?year=${encodeURIComponent(String(selectedYear))}`
                    : "";
                router.push(`/Page/dashboard${qs}`);
              });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        {/* Header */}
        <header className="mb-6 sm:mb-8" ref={headerRef}>
          <div className="bg-gradient-to-r from-[#141D38] via-[#1e2d4a] to-[#2D3A5A] rounded-2xl sm:rounded-3xl shadow-xl border border-slate-700/40 overflow-hidden">
            <div className="p-5 sm:p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 flex-shrink-0">
                    <span className="text-xl sm:text-2xl" aria-hidden>📅</span>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">Schedule</h1>
                    <p className="text-blue-100/90 text-sm sm:text-base mt-0.5">Project timeline & preparer feedback</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs sm:text-sm text-blue-100">Year:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      const nextYear = parseInt(e.target.value, 10);
                      setSelectedYear(nextYear);
                      try {
                        const url = new URL(window.location.href);
                        url.searchParams.set("year", String(nextYear));
                        router.replace(url.pathname + url.search);
                      } catch {
                        // ignore
                      }
                    }}
                    className="bg-white/10 border border-white/30 text-white text-xs sm:text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200/70"
                  >
                    {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                      <option key={y} value={y} className="text-slate-900 bg-white">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Schedule Table */}
        <div className="mb-6 sm:mb-8" ref={tableRef}>
          <div className="bg-gradient-to-r from-[#141D38] via-[#1e2d4a] to-[#2D3A5A] rounded-2xl sm:rounded-3xl shadow-xl border border-slate-700/40 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm">📊</span>
                  Main Schedule
                </h2>
                <button
                  type="button"
                  onClick={() => setMainScheduleCollapsed((prev) => !prev)}
                  className="self-start xs:self-center px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
                  title={mainScheduleCollapsed ? "Expand" : "Collapse"}
                >
                  <span className={`transition-transform duration-200 ${mainScheduleCollapsed ? "rotate-180" : ""}`}>▼</span>
                  <span className="hidden sm:inline">{mainScheduleCollapsed ? "Expand" : "Collapse"}</span>
                </button>
              </div>
            </div>
            {!mainScheduleCollapsed && (
              <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
                <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="bg-white/10 border-b border-white/20">
                    <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-xs sm:text-sm font-bold text-white/90 uppercase tracking-wider">Department</th>
                    <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-xs sm:text-sm font-bold text-white/90 uppercase tracking-wider">Incharge</th>
                    <th className="px-3 py-3 sm:px-6 sm:py-4 text-center text-xs sm:text-sm font-bold text-white/90 uppercase tracking-wider">Start Date</th>
                    <th className="px-3 py-3 sm:px-6 sm:py-4 text-center text-xs sm:text-sm font-bold text-white/90 uppercase tracking-wider">End Date</th>
                    <th className="px-3 py-3 sm:px-6 sm:py-4 text-center text-xs sm:text-sm font-bold text-white/90 uppercase tracking-wider">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {(mainScheduleRows?.length ? mainScheduleRows : DEFAULT_MAIN_SCHEDULE_DATA).flatMap((row, index) => {
                    const mods = Array.isArray(row.inchargeModules) && row.inchargeModules.length > 0 ? row.inchargeModules : [];
                    const isAll = mods.includes("all");
                    const enabledModules = isQuarterly(row.department)
                      ? []
                      : (isAll ? MAIN_MODULES.map((m) => m.key) : MAIN_MODULES.map((m) => m.key).filter((k) => mods.includes(k)));

                    // Modules that still don't have configured schedule (dates/user) for this dept
                    const modulesNeedingSchedule = isQuarterly(row.department)
                      ? []
                      : MAIN_MODULES.filter((m) => !isModuleSavedForMainDept(m.key, row.department));

                    const mainTr = (
                      <tr
                        key={`main:${index}:${row.department}`}
                        className={`border-b border-white/10 transition-colors hover:bg-white/5 ${
                          isQuarterly(row.department) ? "bg-white/5" : ""
                        }`}
                      >
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-white font-medium text-sm sm:text-base">{row.department}</td>
                        <td
                          className="px-3 py-3 sm:px-6 sm:py-4 text-white/80 cursor-pointer hover:bg-white/10 rounded transition-colors text-sm sm:text-base"
                          title="Click to set incharge and dates"
                          onClick={(e) => handleMainEditorOpen(row, e)}
                        >
                          <span className="truncate block max-w-[120px] sm:max-w-none">
                            {isQuarterly(row.department) 
                              ? (row.incharge || "All") 
                              : (isAll 
                                ? "All" 
                                : (mods.length === 0 
                                  ? "Not Set" 
                                  : "Set Schedule"))}
                          </span>
                        </td>
                        <td
                          className="px-3 py-3 sm:px-6 sm:py-4 text-center text-white/90 font-medium cursor-pointer hover:bg-white/10 rounded transition-colors text-sm"
                          title="Click to set start and end dates"
                          onClick={(e) => handleMainEditorOpen(row, e)}
                        >
                          {mods.length === 0 ? "—" : row.startDate}
                        </td>
                        <td
                          className="px-3 py-3 sm:px-6 sm:py-4 text-center text-white/90 font-medium cursor-pointer hover:bg-white/10 rounded transition-colors text-sm"
                          title="Click to set start and end dates"
                          onClick={(e) => handleMainEditorOpen(row, e)}
                        >
                          {mods.length === 0 ? "—" : row.endDate}
                        </td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 sm:px-3 py-1 bg-blue-500/30 rounded-lg text-white font-semibold text-xs sm:text-sm">
                            {mods.length === 0 ? "—" : row.days}
                          </span>
                        </td>
                      </tr>
                    );

                    // If "All" is selected or no modules selected, keep it as a single row (no module breakdown)
                    if (isQuarterly(row.department) || isAll || enabledModules.length === 0 || mods.length === 0) return [mainTr];

                    const deptId = getScheduleIdForMainDept(row.department);
                    const baseRow = BASE_DEPT_ROWS.find((r) => String(r.department_id) === String(deptId)) || null;

                    const moduleRows = enabledModules.map((moduleKey) => {
                      const label = MAIN_MODULES.find((m) => m.key === moduleKey)?.label || moduleKey;
                      const stateRow = getModuleStateRow(moduleKey, deptId) || baseRow;
                      const configured = !!stateRow?.saved;
                      
                      // Check if this module has dates in main schedule moduleDates
                      const moduleDates = row.moduleDates?.[moduleKey];
                      let start = "—";
                      let end = "—";
                      let days = "—";
                      
                      if (moduleDates && moduleDates.startDate && moduleDates.endDate) {
                        // Use dates from main schedule moduleDates
                        start = moduleDates.startDate;
                        end = moduleDates.endDate;
                        const startDate = parseDate(moduleDates.startDate);
                        const endDate = parseDate(moduleDates.endDate);
                        if (startDate && endDate) {
                          days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
                        }
                      } else if (configured) {
                        // Fallback to module schedule dates
                        start = stateRow?.startDate || "—";
                        end = stateRow?.endDate || "—";
                        days = stateRow?.days ?? "—";
                      }
                      
                      const clickable = !!stateRow;

                      return (
                        <tr
                          key={`mod:${row.department}:${moduleKey}`}
                          className="border-b border-white/10 bg-white/5"
                        >
                          <td className="px-3 py-2 sm:px-6 sm:py-3 text-white/80 text-xs sm:text-sm">
                            <span className="inline-block mr-1.5 text-white/40">↳</span>
                            {row.department}
                          </td>
                          <td className="px-3 py-2 sm:px-6 sm:py-3 text-white/80 font-semibold text-xs sm:text-sm">{label}</td>
                          <td
                            className={`px-3 py-2 sm:px-6 sm:py-3 text-center text-white/90 font-medium rounded transition-colors text-xs sm:text-sm ${clickable ? "cursor-pointer hover:bg-white/10" : "opacity-60"}`}
                            title="Click to set this module’s dates in the main schedule"
                            onClick={(e) => handleMainEditorOpen(row, e)}
                          >
                            {start}
                          </td>
                          <td
                            className={`px-3 py-2 sm:px-6 sm:py-3 text-center text-white/90 font-medium rounded transition-colors text-xs sm:text-sm ${clickable ? "cursor-pointer hover:bg-white/10" : "opacity-60"}`}
                            title="Click to set this module’s dates in the main schedule"
                            onClick={(e) => handleMainEditorOpen(row, e)}
                          >
                            {end}
                          </td>
                          <td className="px-3 py-2 sm:px-6 sm:py-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 sm:px-3 py-1 bg-blue-500/20 rounded-lg text-white/90 font-semibold text-xs sm:text-sm">
                              {days}
                            </span>
                          </td>
                        </tr>
                      );
                    });

                    return [mainTr, ...moduleRows];
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>

        {/* Code Procedures */}
        <div ref={feedbackRef} className="space-y-6 sm:space-y-8">
          {[
            { key: "sop-review", title: "A1 SOP Review", rows: sopReviewData },
            { key: "worksheet", title: "B1 Worksheet", rows: worksheetData },
            { key: "audit-finding", title: "B2 Audit Finding", rows: auditFindingData },
            { key: "evidence", title: "B3 Evidence", rows: evidenceData },
          ]
            // Don't filter out archived modules in schedule page - admin should still see schedules
            // Archive only affects dashboard progress display, not schedule management
            .map((section) => {
              // Don't filter out archived departments either - admin should still see all schedules
              // Archive is only for hiding from dashboard progress, not from schedule management
              const visibleRows = (section.rows || []).filter((r) => {
                if (!r) return false;
                return isDeptEnabledForModule(section.key, r.department);
              });
              if (visibleRows.length === 0) return null;
              return { ...section, rows: visibleRows };
            })
            .filter(Boolean)
            .map((section) => (
            <div key={section.key} className="bg-gradient-to-r from-[#141D38] via-[#1e2d4a] to-[#2D3A5A] rounded-2xl sm:rounded-3xl shadow-xl border border-slate-700/40 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-white/60 uppercase tracking-wider">Code Procedures</p>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mt-0.5">{section.title}</h3>
                    <p className="text-blue-200/90 text-sm mt-1">Preparer feedback report</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="bg-white/10 border-b border-white/20">
                      <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-bold text-white/90 uppercase tracking-wider w-16 sm:w-24">ID</th>
                      <th className="px-3 py-2 sm:px-6 sm:py-3 text-left text-xs font-bold text-white/90 uppercase tracking-wider">Sec. Department</th>
                      <th className="px-3 py-2 sm:px-6 sm:py-3 text-center text-xs font-bold text-white/90 uppercase tracking-wider">User</th>
                      <th className="px-3 py-2 sm:px-6 sm:py-3 text-center text-xs font-bold text-white/90 uppercase tracking-wider">Start</th>
                      <th className="px-3 py-2 sm:px-6 sm:py-3 text-center text-xs font-bold text-white/90 uppercase tracking-wider">End</th>
                      <th className="px-2 py-2 sm:px-6 sm:py-3 text-center text-xs font-bold text-white/90 uppercase tracking-wider w-14 sm:w-auto">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-white/10 transition-colors hover:bg-white/5"
                      >
                        <td className="px-2 py-3 sm:px-4 sm:py-4 text-white font-bold text-xs sm:text-sm">{row.id}</td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-white font-medium text-xs sm:text-sm truncate max-w-[140px] sm:max-w-none">{row.department}</td>
                        <td className="px-2 py-3 sm:px-6 sm:py-4 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-1.5 w-full min-w-0 sm:w-48 sm:min-w-[12rem] h-9 sm:h-10 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 px-3 transition-colors text-left"
                            onClick={() => {
                              // Init multi-selection state from existing row.user_id (comma separated)
                              const existingIds = String(row.user_id || "")
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean);
                              setTempSelectedUserIds(existingIds);
                              setUserPickerContext({ moduleKey: section.key, department_id: row.department_id });
                            }}
                            title="Select users (multiple)"
                          >
                            <span className={`text-xs truncate flex-1 min-w-0 ${row.user ? "text-white/95" : "text-white/50"}`}>
                              {row.user || "Select user"}
                            </span>
                            <span className="text-white/50 flex-shrink-0 text-[10px] sm:hidden">›</span>
                          </button>
                        </td>
                        <td
                          className="px-2 py-3 sm:px-6 sm:py-4 text-center text-white/90 font-medium cursor-pointer hover:bg-white/10 rounded transition-colors text-xs sm:text-sm"
                          onClick={(e) => handleDatePickerOpen(section.key, row, e)}
                          title="Set start & end date"
                        >
                          {row.startDate || "—"}
                        </td>
                        <td
                          className="px-2 py-3 sm:px-6 sm:py-4 text-center text-white/90 font-medium cursor-pointer hover:bg-white/10 rounded transition-colors text-xs sm:text-sm"
                          onClick={(e) => handleDatePickerOpen(section.key, row, e)}
                          title="Set start & end date"
                        >
                          {row.endDate || "—"}
                        </td>
                        <td className="px-2 py-3 sm:px-6 sm:py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 sm:px-3 py-1 bg-cyan-500/30 rounded-lg text-white font-semibold text-xs sm:text-sm">
                            {row.days ?? "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Picker Popup Modal */}
      {userPickerContext && (() => {
        const { moduleKey, department_id } = userPickerContext;
        const rows = getModuleRows(moduleKey);
        const row = rows.find((r) => r.department_id === department_id);
        if (!row) return null;
        const pickerKey = buildPickerKey(moduleKey, row);
        const saving = inlineSavingKey === pickerKey;

        const toggleUserInTemp = (id) => {
          setTempSelectedUserIds((prev) => {
            const s = new Set(prev);
            if (s.has(id)) {
              s.delete(id);
            } else {
              s.add(id);
            }
            return Array.from(s);
          });
        };

        const handleSaveUsers = async () => {
          const selectedIds = tempSelectedUserIds;
          const selectedUsers = users.filter((u) => selectedIds.includes(String(u.id)));
          const userIdValue = selectedIds.join(",");
          const userNameValue = selectedUsers.map((u) => u.name).join(", ");

          setInlineSavingKey(pickerKey);
          updateModuleRowState(moduleKey, row.department_id, {
            user: userNameValue,
            user_id: userIdValue,
          });
          const r = await saveModuleRow(moduleKey, row, {
            user_id: userIdValue || null,
            user_name: userNameValue || null,
          });
          setInlineSavingKey("");
          if (!r.ok) {
            toast.show("Failed to update users: " + (r.error || "Unknown error"), "error");
          } else {
            setUserPickerContext(null);
          }
        };

        const isUnassigned = !tempSelectedUserIds || tempSelectedUserIds.length === 0;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !saving && setUserPickerContext(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-[min(420px,95vw)] max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800">Select users</div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    {moduleLabel(moduleKey)} — {row.department}
                  </div>
                </div>
                <button
                  type="button"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors flex-shrink-0 ml-2"
                  onClick={() => !saving && setUserPickerContext(null)}
                >
                  ✕
                </button>
              </div>
              <div className="max-h-72 overflow-auto p-3 space-y-1.5">
                <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                  <input
                    type="checkbox"
                    checked={isUnassigned}
                    disabled={saving}
                    className="text-blue-600"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setTempSelectedUserIds([]);
                      }
                    }}
                  />
                  <div className="text-sm font-semibold text-slate-800">Unassign all</div>
                </label>
                <div className="my-2 border-t border-slate-100" />
                {users.map((u) => {
                  const idStr = String(u.id);
                  const checked = tempSelectedUserIds.includes(idStr);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        className="text-blue-600"
                        onChange={() => toggleUserInTemp(idStr)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800 truncate">{u.name}</div>
                        <div className="text-xs text-slate-500 truncate">{u.email}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500">
                  {isUnassigned
                    ? "No user selected"
                    : `${tempSelectedUserIds.length} user(s) selected`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
                    onClick={() => !saving && setUserPickerContext(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
                    onClick={handleSaveUsers}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Date Picker Modal */}
      {datePickerOpen && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-[min(820px,95vw)] max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800">
                  Set {moduleLabel(selectedModuleKey)} schedule — {selectedRow.department}
                </h3>
                <button
                  type="button"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors flex-shrink-0"
                  onClick={() => setDatePickerOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date range</label>
                  <RangePicker
                    startIso={tempStartDate}
                    endIso={tempEndDate}
                    minIso={tempMinDate}
                    maxIso={tempMaxDate}
                    onChange={({ start, end }) => {
                      setTempStartDate(start);
                      setTempEndDate(end);
                    }}
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
                    onClick={() => setDatePickerOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    onClick={handleDatePickerSave}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Schedule Editor Modal */}
      {mainEditorOpen && selectedMainRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-[min(900px,95vw)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800">Set main schedule — {selectedMainRow.department}</h3>
                <button
                  type="button"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors flex-shrink-0"
                  onClick={() => setMainEditorOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">In charge</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: "not-set", label: "Not Set" },
                    { key: "all", label: "All" },
                    { key: "sop-review", label: "SOP Review" },
                    { key: "worksheet", label: "Worksheet" },
                    { key: "audit-finding", label: "Audit Finding" },
                    { key: "evidence", label: "Evidence" },
                  ].map((opt) => {
                      const isAllSelected = mainTempInchargeModules.includes("all");
                      const isNotSet = opt.key === "not-set";
                      const isModule = opt.key !== "all" && opt.key !== "not-set";
                      const isNotSetSelected = mainTempInchargeModules.length === 0;
                      const checked =
                        isNotSet
                          ? isNotSetSelected
                          : opt.key === "all"
                            ? isAllSelected
                            : (isAllSelected || mainTempInchargeModules.includes(opt.key));
                      const disabled =
                        isNotSet
                          ? false
                          : opt.key === "all"
                            ? false
                            : isAllSelected;
                      return (
                    <label key={opt.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => {
                          // In "All" mode, modules are implicitly selected; toggle All off first to customize.
                          if (isModule && isAllSelected) return;
                          const checkedVal = e.target.checked;
                          setMainTempInchargeModules((prev) => {
                            if (isNotSet) {
                              if (checkedVal) {
                                setMainTempModuleDates({});
                                return [];
                              } else {
                                // If unchecking "Not Set", do nothing (user must select something else)
                                return prev;
                              }
                            }
                            if (opt.key === "all") {
                              if (checkedVal) {
                                setMainTempModuleDates({});
                                return ["all"];
                              }
                              return [];
                            }
                            let next = prev.filter((x) => x !== "all");
                            if (checkedVal) {
                              next = Array.from(new Set([...next, opt.key]));
                              if (!mainTempModuleDates[opt.key]) {
                                setMainTempModuleDates((prevDates) => ({
                                  ...prevDates,
                                  [opt.key]: {
                                    startDate: "",
                                    endDate: "",
                                  },
                                }));
                              }
                            } else {
                              next = next.filter((x) => x !== opt.key);
                              setMainTempModuleDates((prevDates) => {
                                const nextDates = { ...prevDates };
                                delete nextDates[opt.key];
                                return nextDates;
                              });
                            }
                            return next;
                          });
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                      );
                  })}
                </div>
                {mainTempInchargeModules.includes("all") && (
                  <div className="mt-1 text-xs text-slate-500">
                    <span className="font-semibold">All</span> mode is on. Turn off All to choose specific modules.
                  </div>
                )}
                {mainTempInchargeModules.length === 0 && (
                  <div className="mt-1 text-xs text-slate-500">
                    <span className="font-semibold">Not set</span>: choose All or specific modules to configure the schedule.
                  </div>
                )}
              </div>

              {/* Show main dates only when "All" is selected */}
              {mainTempInchargeModules.includes("all") && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date range</label>
                  <RangePicker
                    startIso={mainTempStartDate}
                    endIso={mainTempEndDate}
                    minIso={todayIso}
                    maxIso={null}
                    onChange={({ start, end }) => {
                      setMainTempStartDate(start);
                      setMainTempEndDate(end);
                    }}
                    onReset={() => {
                      setMainTempStartDate("");
                      setMainTempEndDate("");
                    }}
                  />
                </div>
              )}

              {/* Show date pickers for each selected module when not "All" */}
              {!mainTempInchargeModules.includes("all") && mainTempInchargeModules.length > 0 && (
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Date range per module</div>
                  {mainTempInchargeModules
                    .filter((m) => m !== "all")
                    .map((moduleKey) => {
                      const moduleLabel = MAIN_MODULES.find((m) => m.key === moduleKey)?.label || moduleKey;
                      // Get module dates, but ensure empty strings if dates are invalid
                      // Also check if dates are in the past relative to main schedule constraints
                      const modDatesRaw = mainTempModuleDates[moduleKey] || { startDate: "", endDate: "" };
                      
                      // Check if main schedule has valid dates to use as constraints
                      const hasMainDates = (mainTempStartDate && mainTempStartDate !== "" && mainTempStartDate !== "—") ||
                                          (selectedMainRow?.startDate && selectedMainRow.startDate !== "—" && selectedMainRow.startDate !== "");
                      
                      let modDates = {
                        startDate: modDatesRaw.startDate && modDatesRaw.startDate !== "" ? modDatesRaw.startDate : "",
                        endDate: modDatesRaw.endDate && modDatesRaw.endDate !== "" ? modDatesRaw.endDate : "",
                      };
                      
                      // If main schedule has dates, validate module dates are within range
                      // If module dates are before main schedule start date, reset them
                      // Don't validate against end date - allow future dates
                      if (hasMainDates) {
                        const mainMin = mainTempStartDate && mainTempStartDate !== "" && mainTempStartDate !== "—"
                          ? mainTempStartDate
                          : (selectedMainRow?.startDate && selectedMainRow.startDate !== "—" && selectedMainRow.startDate !== ""
                            ? parseDate(selectedMainRow.startDate)
                            : null);
                        
                        // Only validate that dates are not before main schedule start date
                        // Allow dates in the future (no maximum limit)
                        let needsReset = false;
                        if (modDates.startDate && mainMin && modDates.startDate < mainMin) {
                          needsReset = true;
                        }
                        if (modDates.endDate && mainMin && modDates.endDate < mainMin) {
                          needsReset = true;
                        }
                        
                        if (needsReset) {
                          modDates.startDate = "";
                          modDates.endDate = "";
                        }
                      }
                      
                      // Per-module dates in the main schedule editor: floor at today so past dates cannot be chosen.
                      const minIso = todayIso;
                      const maxIso = null;

                      // Debug: log values to understand the issue (commented out for production)
                      // console.log(`RangePicker for ${moduleKey}:`, {
                      //   modDates,
                      //   minIso,
                      //   maxIso,
                      //   mainTempStartDate,
                      //   mainTempEndDate,
                      //   selectedMainRowStart: selectedMainRow?.startDate,
                      //   selectedMainRowEnd: selectedMainRow?.endDate,
                      // });

                      return (
                        <div key={moduleKey} className="border border-slate-200 rounded-xl p-4 bg-slate-50/80">
                          <div className="text-sm font-bold text-slate-800 mb-3">{moduleLabel}</div>
                          <RangePicker
                            startIso={modDates.startDate || ""}
                            endIso={modDates.endDate || ""}
                            minIso={minIso}
                            maxIso={maxIso}
                            onChange={({ start, end }) => {
                              // When reset (both empty), completely remove the dates
                              if (!start && !end) {
                                setMainTempModuleDates((prev) => {
                                  const next = { ...prev };
                                  delete next[moduleKey];
                                  return next;
                                });
                              } else {
                                setMainTempModuleDates((prev) => ({
                                  ...prev,
                                  [moduleKey]: { startDate: start || "", endDate: end || "" },
                                }));
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                  onClick={handleMainScheduleDelete}
                  title="Delete schedule for this department"
                >
                  Delete schedule
                </button>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
                    onClick={() => setMainEditorOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    onClick={handleMainEditorSave}
                  >
                    Save
                  </button>
                </div>
              </div>
          </div>
        </div>
        </div>
      )}

    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">Loading...</div>}>
      <SchedulePageContent />
    </Suspense>
  );
}
