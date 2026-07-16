"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LeaderboardPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/Page/auth");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-sky-900 flex items-center justify-center text-slate-300 text-sm">
        Loading...
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-sky-900 text-white">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-800/80 backdrop-blur-sm p-8 sm:p-10 shadow-xl text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/90 to-orange-500/90 text-2xl mb-5">
            🔧
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">Leaderboard tidak tersedia</h1>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">m
            Halaman ini sedang dalam perbaikan dan disembunyikan sementara untuk semua pengguna. Silakan kembali lagi
            nanti.
          </p>
          <Link
            href="/Page/dashboard"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95 transition-opacity"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
