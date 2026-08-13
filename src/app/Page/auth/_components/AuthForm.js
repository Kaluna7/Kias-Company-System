import { cookies } from "next/headers";
import { ArrowRight, Mail } from "lucide-react";
import AuthErrorBanner from "./AuthErrorBanner";
import PasswordField from "./PasswordField";

function sanitizeCallbackUrl(raw) {
  const fallback = "/Page/dashboard";
  if (!raw || typeof raw !== "string") return fallback;
  try {
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin) return fallback;
    return `${url.pathname}${url.search}` || fallback;
  } catch {
    return fallback;
  }
}

async function getCsrfToken() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("next-auth.csrf-token")?.value;
  if (raw) {
    const token = decodeURIComponent(raw.split("|")[0] || "");
    if (token) return token;
  }

  try {
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/auth/csrf`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    return String(json?.csrfToken || "");
  } catch {
    return "";
  }
}

export default async function AuthForm({ callbackUrl }) {
  const csrfToken = await getCsrfToken();
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);

  return (
    <form
      action="/api/auth/callback/credentials"
      method="post"
      className="space-y-4"
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value={safeCallbackUrl} />

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
          Email Address
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
            placeholder="Enter your email"
          />
        </div>
      </div>

      <PasswordField />

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="remember"
            className="h-4 w-4 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]/30"
          />
          Remember me
        </label>
        <span
          className="text-sm font-medium text-[#2563eb]"
          title="Contact your administrator to reset password"
        >
          Forgot password?
        </span>
      </div>

      <AuthErrorBanner />

      <button
        type="submit"
        className="group mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0f1b4d] via-[#1d4ed8] to-[#3b82f6] px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40"
      >
        Sign In
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </form>
  );
}
