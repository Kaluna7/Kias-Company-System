"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

function mapSignInError(code) {
  if (!code) return "Something went wrong. Please try again.";
  const normalized = String(code).trim();
  if (normalized === "CredentialsSignin") {
    return "Email or password is wrong.";
  }
  return normalized;
}

export default function AuthFormClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (!err) return;
    setErrorMsg(mapSignInError(err));
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      if (!email.trim() || !password) {
        setErrorMsg("Please enter email and password");
        return;
      }

      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
      });

      if (res?.error) {
        setErrorMsg(mapSignInError(res.error));
        return;
      }

      router.push("/Page/dashboard");
      router.refresh();
    } catch (err) {
      console.error("[CLIENT] signIn error:", err);
      setErrorMsg("Error, please try again in 1 minute");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-7">
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            suppressHydrationWarning
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#2b4f82] focus:ring-2 focus:ring-[#2b4f82]/25"
            placeholder="Enter your email"
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              suppressHydrationWarning
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-4 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#2b4f82] focus:ring-2 focus:ring-[#2b4f82]/25"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              suppressHydrationWarning
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#2b4f82]/40"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden />
              ) : (
                <Eye className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          suppressHydrationWarning
          className="w-full rounded-xl bg-gradient-to-r from-[#141D38] to-[#2b4f82] px-4 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </form>
  );
}


