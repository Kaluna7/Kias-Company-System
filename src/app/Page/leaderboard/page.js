"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/app/contexts/ToastContext";

function rankEmoji(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function LeaderboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const yearFromUrl = searchParams.get("year");
  const monthFromUrl = searchParams.get("month");
  const initialYear = (() => {
    if (!yearFromUrl) return currentYear;
    const parsed = parseInt(yearFromUrl, 10);
    return Number.isNaN(parsed) ? currentYear : parsed;
  })();

  const initialMonth = (() => {
    if (!monthFromUrl) return currentMonth;
    const parsed = parseInt(monthFromUrl, 10);
    return Number.isNaN(parsed) || parsed < 1 || parsed > 12 ? currentMonth : parsed;
  })();

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/Page/auth");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function loadLeaderboard() {
      try {
        setIsLoading(true);
        setError("");

        const usersRes = await fetch("/api/users?page=1&pageSize=100", { cache: "no-store" });
        const usersJson = await usersRes.json().catch(() => null);
        if (!usersRes.ok || !usersJson?.success || !Array.isArray(usersJson.users)) {
          throw new Error(usersJson?.error || `Failed to load users (HTTP ${usersRes.status})`);
        }

        const users = usersJson.users;
        if (users.length === 0) {
          setEntries([]);
          setIsLoading(false);
          return;
        }

        const leaderboardEntries = await Promise.all(
          users.map(async (u) => {
            const name = (u.name || "").trim();
            if (!name) {
              return null;
            }
            const initials = name
              .split(" ")
              .map((n) => n[0] || "")
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const avatarUrl = (u.avatar_url || "").toString();
            try {
              const params = new URLSearchParams();
              params.set("userName", name);
              if (selectedYear) params.set("year", String(selectedYear));
              if (selectedMonth) params.set("month", String(selectedMonth));

              const res = await fetch(`/api/dashboard/progress?${params.toString()}`, { cache: "no-store" });
              const json = await res.json().catch(() => null);
              if (!res.ok || !json?.success || !Array.isArray(json.modules)) {
                return null;
              }

              const modules = json.modules;
              let done = 0;
              let total = 0;
              modules.forEach((m) => {
                done += m.done || 0;
                total += m.total || 0;
              });

              const progress = total > 0 ? Math.round((done / total) * 100) : 0;
              const activityScore = done;

              return {
                id: u.id,
                name,
                email: u.email,
                role: u.role,
                initials,
                avatarUrl,
                done,
                total,
                progress,
                activityScore,
              };
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        const cleaned = leaderboardEntries
          .filter(Boolean)
          .sort((a, b) => {
            if (b.progress !== a.progress) return b.progress - a.progress;
            if (b.activityScore !== a.activityScore) return b.activityScore - a.activityScore;
            return a.name.localeCompare(b.name);
          })
          .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

        setEntries(cleaned);
        setIsLoading(false);
      } catch (e) {
        if (cancelled) return;
        const msg = e?.message || "Failed to load leaderboard";
        setError(msg);
        setIsLoading(false);
        toast.show(msg, "error");
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [status, selectedYear, selectedMonth, toast]);

  const topThree = useMemo(() => entries.slice(0, 3), [entries]);
  const rest = useMemo(() => entries.slice(3), [entries]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-sky-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 shadow-lg text-lg">
                🌟
              </span>
              <span>Leaderboard</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              Gamified ranking of user activity and completion across all modules.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-[11px] sm:text-xs">
              <span className="text-slate-300">Year</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const nextYear = parseInt(e.target.value, 10);
                  setSelectedYear(nextYear);
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.set("year", String(nextYear));
                    url.searchParams.set("month", String(selectedMonth));
                    router.replace(url.pathname + url.search);
                  } catch {
                    // ignore
                  }
                }}
                className="bg-transparent border-none text-white text-[11px] sm:text-xs focus:outline-none focus:ring-0 cursor-pointer"
              >
                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y} className="bg-slate-900">
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-[11px] sm:text-xs">
              <span className="text-slate-300">Month</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const nextMonth = parseInt(e.target.value, 10);
                  setSelectedMonth(nextMonth);
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.set("year", String(selectedYear));
                    url.searchParams.set("month", String(nextMonth));
                    router.replace(url.pathname + url.search);
                  } catch {
                    // ignore
                  }
                }}
                className="bg-transparent border-none text-white text-[11px] sm:text-xs focus:outline-none focus:ring-0 cursor-pointer"
              >
                {Array.from({ length: 12 }).map((_, idx) => {
                  const m = idx + 1;
                  const label = new Date(2000, idx, 1).toLocaleString("en", { month: "short" });
                  return (
                    <option key={m} value={m} className="bg-slate-900">
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </header>

        <main className="space-y-6 sm:space-y-8">
          {/* Top 3 podium */}
          <section className="bg-gradient-to-r from-slate-800/90 via-slate-900/95 to-slate-800/90 border border-slate-700/70 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-slate-100">Top Players</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Highest activity & completion score this month.
                </p>
              </div>
              {entries.length > 0 && (
                <div className="text-right text-[11px] sm:text-xs text-slate-400">
                  <p>Total players: {entries.length}</p>
                </div>
              )}
            </div>

            {isLoading && (
              <div className="py-6 text-center text-sm text-slate-300">Loading leaderboard...</div>
            )}
            {!isLoading && error && (
              <div className="py-6 text-center text-sm text-red-300">{error}</div>
            )}
            {!isLoading && !error && entries.length === 0 && (
              <div className="py-6 text-center text-sm text-slate-300">
                No player data yet for this month.
              </div>
            )}

            {!isLoading && !error && entries.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-2">
                {topThree.map((p) => (
                  <div
                    key={p.id}
                    className={`relative rounded-2xl border ${
                      p.rank === 1
                        ? "border-amber-300/80 bg-gradient-to-br from-amber-400/10 via-amber-200/10 to-slate-900/40"
                        : p.rank === 2
                        ? "border-slate-300/70 bg-gradient-to-br from-slate-200/10 via-slate-100/5 to-slate-900/40"
                        : "border-amber-700/60 bg-gradient-to-br from-amber-900/20 via-slate-900/40 to-slate-900/70"
                    } px-3 py-3 sm:px-4 sm:py-4 shadow-lg flex flex-col gap-2`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center mr-1">
                          <span className="text-lg sm:text-xl">{rankEmoji(p.rank)}</span>
                          <span className="text-[10px] text-slate-300 uppercase tracking-wide">
                            Rank
                          </span>
                        </div>
                        <div className="relative flex-shrink-0">
                          {p.avatarUrl ? (
                            <img
                              src={p.avatarUrl}
                              alt={p.name}
                              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl object-cover border border-slate-200/80 shadow-md"
                            />
                          ) : (
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                              {p.initials}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-semibold text-slate-100 truncate max-w-[140px] sm:max-w-[180px]">
                            {p.name}
                          </p>
                          <p className="text-[10px] sm:text-xs text-slate-400">
                            {p.role || "User"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-300">{p.progress}%</p>
                        <p className="text-[10px] text-slate-400">
                          {p.done}/{p.total} missions
                        </p>
                      </div>
                    </div>
                    <div className="mt-1">
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            p.rank === 1
                              ? "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500"
                              : p.rank === 2
                              ? "bg-gradient-to-r from-slate-200 via-slate-300 to-slate-100"
                              : "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400"
                          }`}
                          style={{ width: `${Math.max(5, p.progress)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Full leaderboard list */}
          {!isLoading && !error && entries.length > 0 && (
            <section className="bg-slate-900/80 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-sm sm:text-base font-semibold text-slate-100">All Players</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Sorted by completion percentage and activity score.
                </p>
              </div>
              <div className="space-y-1.5 max-h-[480px] sm:max-h-[560px] overflow-auto pr-1">
                {entries.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/70 hover:border-emerald-400/70 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center justify-center w-9 sm:w-10">
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          p.rank <= 3
                            ? "bg-emerald-400 text-slate-900"
                            : "bg-slate-700 text-slate-100"
                        }`}
                      >
                        {p.rank}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative flex-shrink-0">
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt={p.name}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl object-cover border border-slate-200/80 shadow-md"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                            {p.initials}
                          </div>
                        )}
                      </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {p.email} · {(p.role || "User").toString()}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400"
                            style={{ width: `${Math.max(3, p.progress)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-200 font-semibold w-14 text-right">
                          {p.progress}%
                        </span>
                        <span className="text-[10px] text-slate-400 w-16 text-right">
                          {p.done}/{p.total}
                        </span>
                      </div>
                    </div>
                  </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

