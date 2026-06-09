import { cookies } from "next/headers";
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
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-7">
      <form
        action="/api/auth/callback/credentials"
        method="post"
        className="space-y-4"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="callbackUrl" value={safeCallbackUrl} />

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#2b4f82] focus:ring-2 focus:ring-[#2b4f82]/25"
            placeholder="Enter your email"
          />
        </div>

        <PasswordField />

        <AuthErrorBanner />

        <button
          type="submit"
          className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#141D38] to-[#2b4f82] px-4 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
