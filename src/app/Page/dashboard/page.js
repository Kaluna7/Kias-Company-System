// src/app/Page/dashboard/page.js
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import nextDynamic from "next/dynamic";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/app/contexts/ToastContext";
import { exportSamplingToExcel } from "@/app/utils/exportSamplingExcel";
import {
  canCreateAccounts,
  canManageSchedule,
  isAdminLikeRole,
  isSuperAdmin,
} from "@/lib/roles";
import { Eye, EyeOff } from "lucide-react";

const ChatSidebar = nextDynamic(() => import("./ChatSidebar"), { ssr: false });

const BASE_AUDIT_ITEMS = [
  { id: "A1", title: "SOP Review", category: "planning", href: "/Page/sop-review/" },
  { id: "B1", title: "Worksheet", category: "execution", href: "/Page/worksheet/" },
  { id: "C1", title: "Audit Review", category: "review", href: "/Page/audit-review/" },
  { id: "A2", title: "Risk Assessment", category: "planning", href: "/Page/risk-assessment-dashboard" },
  { id: "B2", title: "Finding", category: "execution", href: "/Page/audit-finding/" },
  { id: "C2", title: "Report", category: "review", href: "/Page/report/" },
  { id: "A3", title: "Audit Program", category: "planning", href: "/Page/audit-program/" },
  { id: "B3", title: "Evidences", category: "execution", href: "/Page/evidence/" },
  { id: "C3", title: "Guidelines", category: "review", href: "/Page/guidelines/" },
  { id: "C4", title: "Files", category: "review", href: "/Page/files/" },
  { id: "S1", title: "Sampling", category: "review", href: null, openSampling: true },
];

function getCategoryIcon(category) {
  return category === "planning" ? "📋" : category === "execution" ? "🔍" : "📊";
}
function getCategoryColor(category) {
  return category === "planning" ? "from-blue-500 to-cyan-500" : category === "execution" ? "from-green-500 to-emerald-500" : "from-purple-500 to-indigo-500";
}

/** Clipboard API often fails in modals / non-HTTPS — fallback to execCommand. */
async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // try fallback below
    }
  }

  if (typeof document === "undefined") return false;

  try {
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "");
    el.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Stable Dashboard: all hooks declared unconditionally.
 * Optimized for mobile: lazy ChatSidebar, memoized data, reduced heavy CSS.
 */
function DashboardPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState("all");
  const currentYear = new Date().getFullYear();
  const yearFromUrl = searchParams.get("year");
  const initialYear = (() => {
    if (!yearFromUrl) return currentYear;
    const parsed = parseInt(yearFromUrl, 10);
    return Number.isNaN(parsed) ? currentYear : parsed;
  })();
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [changeEmailStep, setChangeEmailStep] = useState(0); // 0=email, 1=password, 2=success
  const [newEmail, setNewEmail] = useState("");
  const [changeEmailPassword, setChangeEmailPassword] = useState("");
  const [showChangeEmailPassword, setShowChangeEmailPassword] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isTempPasswordOpen, setIsTempPasswordOpen] = useState(false);
  const [tempPasswordUserId, setTempPasswordUserId] = useState("");
  const [tempPasswordValue, setTempPasswordValue] = useState("");
  const [tempPasswordResult, setTempPasswordResult] = useState("");
  const [isCreatingTempPassword, setIsCreatingTempPassword] = useState(false);
  const [isHelpSupportOpen, setIsHelpSupportOpen] = useState(false);
  const [isSamplingOpen, setIsSamplingOpen] = useState(false);
  const [samplingConfidence, setSamplingConfidence] = useState("");
  const [samplingTotalData, setSamplingTotalData] = useState("");
  const [samplingSequence, setSamplingSequence] = useState([]);
  const [samplingMeta, setSamplingMeta] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [editName, setEditName] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountRole, setNewAccountRole] = useState("user");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [progress, setProgress] = useState({ loading: true, error: null, modules: [] });
  const [progressModuleKey, setProgressModuleKey] = useState("sop-review");
  const [expandedModuleKey, setExpandedModuleKey] = useState(null);
  const [progressUsers, setProgressUsers] = useState([]);
  const [progressUserName, setProgressUserName] = useState("");
  const [archivingModuleKey, setArchivingModuleKey] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    tone: "danger",
  });
  const confirmActionRef = useRef(null);
  const tempPasswordInputRef = useRef(null);

  const role = (session?.user?.role || "").toLowerCase();
  const isAdmin = isAdminLikeRole(role);
  // Create Account menu: super_admin only
  const canCreateEmployeeAccount = isSuperAdmin(role) && canCreateAccounts(role);
  const canOpenSchedule = canManageSchedule(role);

  const auditItems = useMemo(
    () =>
      canOpenSchedule
        ? [{ id: "D1", title: "Schedule", category: "planning", href: "/Page/schedule/" }, ...BASE_AUDIT_ITEMS]
        : BASE_AUDIT_ITEMS,
    [canOpenSchedule]
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
      const callback = encodeURIComponent("/Page/dashboard");
      router.replace(`/?callbackUrl=${callback}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loadProgressRef = useRef(null);
  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      setProgress({ loading: false, error: null, modules: [] });
      return;
    }
    let mounted = true;
    async function loadProgress() {
      try {
        const role = (session?.user?.role || "").toLowerCase();
        const isAdmin = isAdminLikeRole(role);
        const userName = (session?.user?.name || "").trim();
        const effectiveUserName = isAdmin ? (progressUserName || "") : userName;

        const params = new URLSearchParams();
        if (effectiveUserName) params.set("userName", effectiveUserName);
        if (selectedYear) params.set("year", String(selectedYear));
        const qs = params.toString();

        const res = await fetch(`/api/dashboard/progress${qs ? `?${qs}` : ""}`, { cache: "no-store" });
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
    loadProgressRef.current = loadProgress;
    loadProgress();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.name, session?.user?.role, progressUserName, selectedYear]);

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

  // Refetch progress when user returns to this tab (e.g. after clicking Publish elsewhere)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && loadProgressRef.current) loadProgressRef.current();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadUsersIfAdmin() {
      try {
        const role = (session?.user?.role || "").toLowerCase();
        const isAdmin = isAdminLikeRole(role);
        if (!isAdmin) {
          setProgressUsers([]);
          setProgressUserName("");
          return;
        }
        const res = await fetch("/api/users?page=1&pageSize=500", { cache: "no-store" });
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

  const effectiveName = profileName || userName;

  const initials = effectiveName
    .split(" ")
    .map((n) => n[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleFilterClick = useCallback((filterId) => setActiveCategory(filterId), []);
  const handleViewDetail = useCallback(
    (item) => {
      if (item?.openSampling) {
        setIsSamplingOpen(true);
        return;
      }
      if (!item?.href) return;
      const url = new URL(item.href, window.location.origin);
      if (selectedYear) {
        url.searchParams.set("year", String(selectedYear));
      }
      router.push(`${url.pathname}${url.search}`);
    },
    [selectedYear, router],
  );

  const closeSamplingModal = useCallback(() => {
    setIsSamplingOpen(false);
  }, []);

  const runSamplingGenerate = useCallback(() => {
    const conf = parseFloat(String(samplingConfidence).replace(",", "."), 10);
    const total = parseInt(String(samplingTotalData).trim(), 10);
    if (Number.isNaN(conf) || conf < 0 || conf > 100) {
      toast.show("Confidence level must be between 0 and 100.", "error");
      return;
    }
    if (Number.isNaN(total) || total < 1) {
      toast.show("Total data must be a positive integer.", "error");
      return;
    }
    const samplingRate = (100 - conf) / 100;
    const rawSize = Math.round(total * samplingRate);
    const sampleSize = Math.min(Math.max(0, rawSize), total);
    if (sampleSize < 1) {
      toast.show("Sample size is 0 for these inputs. Lower confidence or increase total data.", "error");
      setSamplingSequence([]);
      setSamplingMeta(null);
      return;
    }
    const pool = Array.from({ length: total }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, sampleSize).sort((a, b) => a - b);
    const meta = { conf, total, samplingRate, sampleSize, picked };
    setSamplingSequence(picked);
    setSamplingMeta(meta);
    toast.show(`Generated ${sampleSize} random item(s).`, "success");
  }, [samplingConfidence, samplingTotalData, toast]);

  const exportSamplingExcel = useCallback(() => {
    if (!samplingMeta?.picked?.length) {
      toast.show("Nothing to export. Generate a sampling first.", "error");
      return;
    }
    try {
      exportSamplingToExcel({ ...samplingMeta });
      toast.show("Excel download started.", "success");
    } catch (err) {
      console.error("exportSamplingExcel:", err);
      toast.show("Failed to export Excel.", "error");
    }
  }, [samplingMeta, toast]);
  const toggleExpanded = useCallback((key) => {
    setExpandedModuleKey((prev) => (prev === key ? null : key));
  }, []);
  const closeConfirmDialog = useCallback(() => {
    confirmActionRef.current = null;
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);
  const openConfirmDialog = useCallback((options, onConfirm) => {
    confirmActionRef.current = onConfirm;
    setConfirmDialog({
      open: true,
      title: options?.title || "Please confirm",
      message: options?.message || "",
      confirmLabel: options?.confirmLabel || "Confirm",
      tone: options?.tone || "danger",
    });
  }, []);
  const handleConfirmDialogConfirm = useCallback(async () => {
    const action = confirmActionRef.current;
    closeConfirmDialog();
    if (typeof action === "function") {
      await action();
    }
  }, [closeConfirmDialog]);

  const archiveModule = useCallback(
    async (moduleKey) => {
      openConfirmDialog(
        {
          title: "Finish module?",
          message: `This will mark "${moduleKey}" as finished and remove its schedules from both the main schedule and module schedule.`,
          confirmLabel: "Finish module",
          tone: "danger",
        },
        async () => {
          try {
            setArchivingModuleKey(moduleKey);
            const res = await fetch("/api/schedule/archive", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ module_key: moduleKey, scope: "module" }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.success) {
              toast.show(`Failed to finish module: ${json?.error || `HTTP ${res.status}`}`, "error");
              return;
            }
            setProgress((p) => ({ ...p, loading: true }));
            const roleNow = (session?.user?.role || "").toLowerCase();
            const isAdminNow = isAdminLikeRole(roleNow);
            const userName = (session?.user?.name || "").trim();
            const effectiveUserName = isAdminNow ? progressUserName : userName;
            const params = new URLSearchParams();
            if (effectiveUserName) {
              params.set("userName", effectiveUserName);
            }
            if (selectedYear) {
              params.set("year", String(selectedYear));
            }
            const qs = params.toString() ? `?${params.toString()}` : "";
            const r2 = await fetch(`/api/dashboard/progress${qs}`, { cache: "no-store" });
            const j2 = await r2.json().catch(() => null);
            if (r2.ok && j2?.success) {
              const modules = Array.isArray(j2.modules) ? j2.modules : [];
              setProgress({ loading: false, error: null, modules });
            } else {
              setProgress({ loading: false, error: j2?.error || `HTTP ${r2.status}`, modules: [] });
            }
            toast.show(`"${moduleKey}" was finished and its schedules were removed successfully.`, "success");
          } catch (e) {
            toast.show(`Failed to finish module: ${e?.message || String(e)}`, "error");
          } finally {
            setArchivingModuleKey("");
          }
        }
      );
    },
    [openConfirmDialog, progressUserName, selectedYear, session?.user?.name, session?.user?.role, toast]
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.success && json.user) {
          setProfileName(json.user.name || "");
          setProfileAvatarUrl(json.user.avatarUrl || "");
        }
      } catch {
        // ignore profile load errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const openEditProfile = useCallback(() => {
    setIsProfileOpen(false);
    setEditName(effectiveName || "");
    setEditAvatarFile(null);
    setEditAvatarPreview(profileAvatarUrl || "");
    setIsEditProfileOpen(true);
  }, [effectiveName, profileAvatarUrl]);

  const closeEditProfile = useCallback(() => {
    if (isSavingProfile) return;
    setIsEditProfileOpen(false);
  }, [isSavingProfile]);

  const openChangeEmail = useCallback(() => {
    setNewEmail("");
    setChangeEmailPassword("");
    setShowChangeEmailPassword(false);
    setChangeEmailStep(0);
    setIsChangeEmailOpen(true);
  }, []);

  const closeChangeEmail = useCallback(() => {
    if (isChangingEmail) return;
    if (changeEmailStep === 2) return;
    setIsChangeEmailOpen(false);
    setNewEmail("");
    setChangeEmailPassword("");
    setShowChangeEmailPassword(false);
    setChangeEmailStep(0);
  }, [isChangingEmail, changeEmailStep]);

  const handleChangeEmailContinue = useCallback(() => {
    const email = (newEmail || "").trim().toLowerCase();
    const current = String(session?.user?.email || "").toLowerCase();
    if (!email) {
      toast.show("Please enter a new email.", "warning");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.show("Please enter a valid email address.", "warning");
      return;
    }
    if (email === current) {
      toast.show("New email must be different from your current email.", "warning");
      return;
    }
    setChangeEmailStep(1);
  }, [newEmail, session?.user?.email, toast]);

  const handleChangeEmailSubmit = useCallback(async () => {
    const email = (newEmail || "").trim().toLowerCase();
    if (!changeEmailPassword) {
      toast.show("Please enter your password.", "warning");
      return;
    }
    try {
      setIsChangingEmail(true);
      const res = await fetch("/api/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: email, password: changeEmailPassword }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show(json?.error || `Failed to change email (HTTP ${res.status})`, "error");
        return;
      }
      setChangeEmailStep(2);
      setTimeout(() => {
        signOut({ callbackUrl: "/" });
      }, 1800);
    } catch (e) {
      toast.show(e?.message || "Failed to change email.", "error");
    } finally {
      setIsChangingEmail(false);
    }
  }, [newEmail, changeEmailPassword, toast]);

  const openChangePassword = useCallback(() => {
    setIsProfileOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setIsChangePasswordOpen(true);
  }, []);

  const closeChangePassword = useCallback(() => {
    if (isChangingPassword) return;
    setIsChangePasswordOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  }, [isChangingPassword]);

  const openCreateAccount = useCallback(() => {
    setIsProfileOpen(false);
    setNewAccountName("");
    setNewAccountEmail("");
    setNewAccountPassword("");
    setNewAccountRole("user");
    setIsCreateAccountOpen(true);
  }, []);

  const closeCreateAccount = useCallback(() => {
    if (isCreatingAccount) return;
    setIsCreateAccountOpen(false);
  }, [isCreatingAccount]);

  const openTempPassword = useCallback(() => {
    setIsProfileOpen(false);
    setTempPasswordUserId("");
    setTempPasswordValue("");
    setTempPasswordResult("");
    setIsTempPasswordOpen(true);
  }, []);

  const closeTempPassword = useCallback(() => {
    if (isCreatingTempPassword) return;
    setIsTempPasswordOpen(false);
    setTempPasswordUserId("");
    setTempPasswordValue("");
    setTempPasswordResult("");
  }, [isCreatingTempPassword]);

  const handleCreateTempPassword = useCallback(async () => {
    const userId = String(tempPasswordUserId || "").trim();
    if (!userId) {
      toast.show("Please select a user.", "warning");
      return;
    }
    const manual = String(tempPasswordValue || "").trim();
    if (manual && manual.length < 6) {
      toast.show("Temporary password must be at least 6 characters.", "warning");
      return;
    }

    try {
      setIsCreatingTempPassword(true);
      const res = await fetch("/api/users/temp-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          password: manual || undefined,
          generate: !manual,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show(json?.error || `Failed to create temporary password (HTTP ${res.status})`, "error");
        return;
      }
      setTempPasswordResult(String(json.temporaryPassword || ""));
      setTempPasswordValue("");
      toast.show("Temporary password created. Valid for one login only.", "success");
    } catch (e) {
      toast.show(e?.message || "Failed to create temporary password.", "error");
    } finally {
      setIsCreatingTempPassword(false);
    }
  }, [tempPasswordUserId, tempPasswordValue, toast]);

  const handleCopyTempPassword = useCallback(async () => {
    if (!tempPasswordResult) return;
    const copied = await copyTextToClipboard(tempPasswordResult);
    if (copied) {
      toast.show("Temporary password copied.", "success");
      return;
    }
    const input = tempPasswordInputRef.current;
    if (input) {
      input.focus();
      input.select();
      input.setSelectionRange(0, tempPasswordResult.length);
    }
    toast.show("Password selected — press Ctrl+C (or Cmd+C) to copy.", "warning");
  }, [tempPasswordResult, toast]);

  const openHelpSupport = useCallback(() => {
    setIsProfileOpen(false);
    setIsHelpSupportOpen(true);
  }, []);
  const closeHelpSupport = useCallback(() => {
    setIsHelpSupportOpen(false);
  }, []);

  const handleAvatarChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatarFile(file);
    const url = URL.createObjectURL(file);
    setEditAvatarPreview(url);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    const nameToSave = (editName || "").trim();
    if (!nameToSave) {
      toast.show("Name cannot be empty.", "warning");
      return;
    }
    try {
      setIsSavingProfile(true);
      const formData = new FormData();
      formData.append("name", nameToSave);
      if (editAvatarFile) {
        formData.append("avatar", editAvatarFile);
      }
      const res = await fetch("/api/profile", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const serverError = String(json?.error || "").toLowerCase();
        const isImageTooLarge =
          res.status === 403 ||
          res.status === 413 ||
          serverError.includes("too large") ||
          serverError.includes("payload");
        toast.show(
          isImageTooLarge
            ? "Image too large. Please upload a smaller image."
            : json?.error || `Failed to update profile (HTTP ${res.status})`,
          "error"
        );
        return;
      }
      setProfileName(json.user?.name || nameToSave);
      setProfileAvatarUrl(json.user?.avatarUrl || "");
      setIsEditProfileOpen(false);
      toast.show("Profile updated successfully.", "success");
    } catch (e) {
      toast.show(e?.message || "Failed to update profile.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  }, [editName, editAvatarFile, toast]);

  const handleChangePassword = useCallback(async () => {
    if (!newPassword || !confirmPassword) {
      toast.show("Please fill in new password and confirmation.", "warning");
      return;
    }
    if (newPassword.length < 6) {
      toast.show("New password must be at least 6 characters.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.show("New password and confirmation do not match.", "warning");
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show(json?.error || `Failed to change password (HTTP ${res.status})`, "error");
        return;
      }
      setIsChangePasswordOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      toast.show("Password changed successfully.", "success");
    } catch (e) {
      toast.show(e?.message || "Failed to change password.", "error");
    } finally {
      setIsChangingPassword(false);
    }
  }, [newPassword, confirmPassword, toast]);

  const helpSupportText = "Halo, system kias ada error.";
  const helpSupportLink = `https://wa.me/qr/K5GKCLOXIZ3CE1?text=${encodeURIComponent(helpSupportText)}`;

  const handleCreateAccount = useCallback(async () => {
    const name = (newAccountName || "").trim();
    const email = (newAccountEmail || "").toLowerCase().trim();
    const password = String(newAccountPassword || "");
    const role = (newAccountRole || "user").toLowerCase();

    if (!name || !email || !password) {
      toast.show("Name, email, and password are required.", "warning");
      return;
    }
    if (password.length < 6) {
      toast.show("Password must be at least 6 characters.", "warning");
      return;
    }

    try {
      setIsCreatingAccount(true);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.show(json?.error || `Failed to create account (HTTP ${res.status})`, "error");
        return;
      }

      setProgressUsers((prev) => {
        const next = [...prev, json.user].filter(Boolean);
        next.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
        return next;
      });
      setIsCreateAccountOpen(false);
      toast.show("Employee account created successfully.", "success");
    } catch (e) {
      toast.show(e?.message || "Failed to create account.", "error");
    } finally {
      setIsCreatingAccount(false);
    }
  }, [newAccountName, newAccountEmail, newAccountPassword, newAccountRole, toast]);

  const handleDeleteUser = useCallback(
    async (user) => {
      const userId = String(user?.id || "").trim();
      if (!userId) return;
      openConfirmDialog(
        {
          title: "Delete user?",
          message: `Delete "${user.name}" (${user.email})? This action cannot be undone.`,
          confirmLabel: "Delete user",
          tone: "danger",
        },
        async () => {
          try {
            setDeletingUserId(userId);
            const res = await fetch("/api/users", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: userId }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.success) {
              toast.show(json?.error || `Failed to delete user (HTTP ${res.status})`, "error");
              return;
            }

            setProgressUsers((prev) => prev.filter((u) => String(u?.id) !== userId));
            toast.show("User deleted successfully.", "success");
          } catch (e) {
            toast.show(e?.message || "Failed to delete user.", "error");
          } finally {
            setDeletingUserId("");
          }
        }
      );
    },
    [openConfirmDialog, toast]
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
                    {profileAvatarUrl ? (
                      <img
                        src={profileAvatarUrl}
                        alt={effectiveName}
                        className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border border-white/40 shadow-lg"
                      />
                    ) : (
                      <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-lg">
                        {initials}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 rounded-full border-2 border-[#2D3A5A]"></div>
                  </div>
                  <div className="text-left text-white hidden md:block">
                    <p className="font-semibold text-sm xl:text-base truncate max-w-[120px] xl:max-w-none">{effectiveName}</p>
                    <p className="text-blue-200 text-xs capitalize">{userRole}</p>
                  </div>
                  <svg className={`w-4 h-4 text-white transition-transform duration-300 flex-shrink-0 hidden sm:block ${isProfileOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {/* Dropdown: below profile, right-aligned */}
                <div className={`absolute right-0 top-full mt-2 w-56 sm:w-64 bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-200 py-3 z-20 transition-[opacity,transform] duration-200 ${isProfileOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none invisible"}`}>
                  <div className="px-4 py-3 border-b border-gray-200/30">
                    <div className="flex items-center space-x-3">
                      {profileAvatarUrl ? (
                        <img
                          src={profileAvatarUrl}
                          alt={effectiveName}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 text-sm truncate">{effectiveName}</p>
                        <p className="text-gray-600 text-xs capitalize">{userRole}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-2 py-2 space-y-1">
                    <button
                      type="button"
                      onClick={openEditProfile}
                      className="w-full flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors text-sm"
                    >
                      <span className="font-medium">Edit Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={openChangePassword}
                      className="w-full flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors text-sm"
                    >
                      <span className="font-medium">Change Password</span>
                    </button>
                    {canCreateEmployeeAccount && (
                      <button
                        type="button"
                        onClick={openCreateAccount}
                        className="w-full flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors text-sm"
                      >
                        <span className="font-medium">Create Account</span>
                      </button>
                    )}
                    {canCreateEmployeeAccount && (
                      <button
                        type="button"
                        onClick={openTempPassword}
                        className="w-full flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors text-sm"
                      >
                        <span className="font-medium">Temporary Password</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openHelpSupport}
                      className="w-full flex items-center px-4 py-2.5 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors text-sm"
                    >
                      <span className="font-medium">Help & Support</span>
                    </button>
                  </div>
                  <div className="border-t border-gray-200/30 mt-1 pt-1 px-2">
                    <button onClick={() => signOut({ callbackUrl: "/" })} className="w-full flex items-center px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm"><span className="font-medium">Sign Out</span></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats row + year filter */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="grid grid-cols-2 md:flex md:gap-6 lg:gap-8 gap-3 flex-1">
                {statsAndFilters.stats.map((stat) => (
                  <div key={stat.type} className="text-center py-2 md:py-0">
                    <div className="text-2xl sm:text-3xl font-bold text-white">{stat.count}</div>
                    <div className="text-xs sm:text-sm text-blue-200 font-medium">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto">
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
                      // ignore URL errors in unlikely environments
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
                return isAdminLikeRole(role);
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
                    const showFinish = isAdminLikeRole(role) && m.total > 0 && m.done === m.total;

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

      {isEditProfileOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-3 p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit Profile</h2>
                <p className="text-xs text-slate-500 mt-1">Update your display name, email, and profile photo.</p>
              </div>
              <button
                type="button"
                onClick={closeEditProfile}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isSavingProfile}
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                {editAvatarPreview || profileAvatarUrl ? (
                  <img
                    src={editAvatarPreview || profileAvatarUrl}
                    alt={effectiveName}
                    className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                    {initials}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white shadow-md border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h4l2-3h6l2 3h4v12H3V7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11a3 3 0 100 6 3 3 0 000-6z" />
                  </svg>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Email</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={session?.user?.email || ""}
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={openChangeEmail}
                    className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold text-[#141D38] border border-slate-200 hover:bg-slate-50 whitespace-nowrap"
                    disabled={isSavingProfile}
                  >
                    Change email
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeEditProfile}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={isSavingProfile}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#141D38] to-[#2D3A5A] hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSavingProfile}
              >
                {isSavingProfile ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isChangeEmailOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-3 p-6 space-y-5 overflow-hidden">
            {changeEmailStep === 2 ? (
              <div className="py-6 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Email has been changed</h2>
                <p className="text-sm text-slate-500">
                  You will be signed out. Please log in again with your new email.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Change Email</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {changeEmailStep === 0
                        ? "Enter your new email address."
                        : "Confirm with your current password."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeChangeEmail}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    disabled={isChangingEmail}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="relative overflow-hidden">
                  <div
                    className="flex w-[200%] transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(-${changeEmailStep * 50}%)` }}
                  >
                    <div className="w-1/2 pr-1 space-y-3 shrink-0">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700">New Email</label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                          placeholder="new@email.com"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <div className="w-1/2 pl-1 space-y-3 shrink-0">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-700">Password</label>
                        <div className="relative">
                          <input
                            type={showChangeEmailPassword ? "text" : "password"}
                            value={changeEmailPassword}
                            onChange={(e) => setChangeEmailPassword(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                            placeholder="Current password"
                            autoComplete="current-password"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleChangeEmailSubmit();
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowChangeEmailPassword((v) => !v)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            aria-label={showChangeEmailPassword ? "Hide password" : "Show password"}
                          >
                            {showChangeEmailPassword ? (
                              <EyeOff className="h-4 w-4" aria-hidden />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-2 pt-2">
                  {changeEmailStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => setChangeEmailStep(0)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                      disabled={isChangingEmail}
                    >
                      Back
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closeChangeEmail}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                      disabled={isChangingEmail}
                    >
                      Cancel
                    </button>
                  )}
                  {changeEmailStep === 0 ? (
                    <button
                      type="button"
                      onClick={handleChangeEmailContinue}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#141D38] to-[#2D3A5A] hover:shadow-md"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleChangeEmailSubmit}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#141D38] to-[#2D3A5A] hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isChangingEmail}
                    >
                      {isChangingEmail ? "Verifying..." : "Confirm"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-3 p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
                <p className="text-xs text-slate-500 mt-1">Set a new password for your account.</p>
              </div>
              <button
                type="button"
                onClick={closeChangePassword}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isChangingPassword}
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeChangePassword}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={isChangingPassword}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#141D38] to-[#2D3A5A] hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? "Saving..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateAccountOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-3 p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create Account</h2>
                <p className="text-xs text-slate-500 mt-1">Super admin can create user, reviewer, and super admin accounts.</p>
              </div>
              <button
                type="button"
                onClick={closeCreateAccount}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isCreatingAccount}
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  placeholder="Employee name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  placeholder="employee@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Role</label>
                <select
                  value={newAccountRole}
                  onChange={(e) => setNewAccountRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                >
                  <option value="user">User</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800">All Accounts</h3>
                <span className="text-xs text-slate-500">{progressUsers.length} account(s)</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                {progressUsers.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-500">No accounts found.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {progressUsers.map((u) => {
                      const uRole = String(u.role || "user").toLowerCase();
                      const isSelf =
                        String(u.email || "").toLowerCase() ===
                        String(session?.user?.email || "").toLowerCase();
                      return (
                        <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-800 truncate">{u.name}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {u.email} · {uRole}
                              {isSelf ? " · you" : ""}
                            </div>
                          </div>
                          {isSelf ? (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-slate-400 bg-slate-50 whitespace-nowrap">
                              You
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              disabled={deletingUserId === String(u.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {deletingUserId === String(u.id) ? "Deleting..." : "Delete"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeCreateAccount}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={isCreatingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAccount}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#141D38] to-[#2D3A5A] hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isCreatingAccount}
              >
                {isCreatingAccount ? "Creating..." : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isTempPasswordOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-3 p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Temporary Password</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Create a one-time password for a selected user. After one successful login it is deleted
                  automatically. The user&apos;s normal password stays unchanged.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTempPassword}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isCreatingTempPassword}
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Select user</label>
                <select
                  value={tempPasswordUserId}
                  onChange={(e) => {
                    setTempPasswordUserId(e.target.value);
                    setTempPasswordResult("");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                >
                  <option value="">Choose user…</option>
                  {progressUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Temporary password <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={tempPasswordValue}
                  onChange={(e) => setTempPasswordValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
                  placeholder="Leave empty to auto-generate"
                  autoComplete="off"
                />
                <p className="text-[11px] text-slate-500">
                  If empty, a random password will be generated and shown once below.
                </p>
              </div>

              {tempPasswordResult ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800">One-time password (copy now)</p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={tempPasswordInputRef}
                      type="text"
                      readOnly
                      value={tempPasswordResult}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => e.target.select()}
                      className="flex-1 min-w-0 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      aria-label="Temporary password"
                    />
                    <button
                      type="button"
                      onClick={handleCopyTempPassword}
                      className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-100"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Valid for one login only. Share it securely with the selected user.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeTempPassword}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                disabled={isCreatingTempPassword}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCreateTempPassword}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#141D38] to-[#2D3A5A] hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isCreatingTempPassword || !tempPasswordUserId}
              >
                {isCreatingTempPassword ? "Creating..." : "Create temporary password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${confirmDialog.tone === "danger" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86l-7.14 12A2 2 0 004.86 19h14.28a2 2 0 001.71-3.14l-7.14-12a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{confirmDialog.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDialogConfirm}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed ${confirmDialog.tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-[#141D38] hover:bg-[#0f1730]"}`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {isSamplingOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 py-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 p-4 my-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Sampling</h3>
                <p className="mt-0.5 text-xs text-slate-600 leading-snug">
                  Sample size = total × (100% − confidence). Client only, not saved.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSamplingModal}
                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Confidence level (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={samplingConfidence}
                  onChange={(e) => setSamplingConfidence(e.target.value)}
                  placeholder="e.g. 90"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-[#141D38] focus:ring-1 focus:ring-[#141D38]/25 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Total data</label>
                <input
                  type="number"
                  min={1}
                  value={samplingTotalData}
                  onChange={(e) => setSamplingTotalData(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 focus:border-[#141D38] focus:ring-1 focus:ring-[#141D38]/25 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Implicit rate:{" "}
                <span className="font-semibold text-slate-700">
                  {(() => {
                    const c = parseFloat(String(samplingConfidence).replace(",", "."), 10);
                    if (Number.isNaN(c) || c < 0 || c > 100) return "—";
                    return `${(100 - c).toFixed(1).replace(/\.0$/, "")}%`;
                  })()}
                </span>
              </p>
              <button
                type="button"
                onClick={runSamplingGenerate}
                className="w-full rounded-lg bg-gradient-to-r from-[#141D38] to-[#2D3A5A] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:shadow transition-shadow"
              >
                Generate
              </button>

              {samplingSequence.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Sampling sequence ({samplingSequence.length} items)
                  </div>
                  <div
                    className="mt-2 max-h-[12rem] overflow-y-auto overscroll-y-contain rounded-md border border-slate-200 bg-white [scrollbar-gutter:stable]"
                    role="region"
                    aria-label="Sample indices scroll area"
                  >
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600">
                          <th className="px-2 py-1 text-left font-semibold">Baris</th>
                          <th className="px-2 py-1 text-left font-semibold">Nomor sampel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {samplingSequence.map((n, idx) => (
                          <tr key={`${idx}-${n}`} className="border-t border-slate-100">
                            <td className="px-2 py-1 text-slate-600 font-medium">Row {idx + 1}</td>
                            <td className="px-2 py-1 tabular-nums font-mono font-medium text-slate-800">{n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={exportSamplingExcel}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!samplingMeta?.picked?.length}
                >
                  Download Excel
                </button>
                <button
                  type="button"
                  onClick={closeSamplingModal}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isHelpSupportOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Help & Support</h3>
                <p className="mt-1 text-sm text-slate-600">Contact support via WhatsApp.</p>
              </div>
              <button
                type="button"
                onClick={closeHelpSupport}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Auto message</p>
              <p className="mt-1 text-sm text-slate-700">{helpSupportText}</p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeHelpSupport}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <a
                href={helpSupportLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#25D366] hover:bg-[#1ebe5d]"
              >
                Contact via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}
