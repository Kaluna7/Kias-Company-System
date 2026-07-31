"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

function mapSignInError(code) {
  if (!code) return "Something went wrong. Please try again.";
  const normalized = String(code).trim();
  if (normalized === "CredentialsSignin") {
    return "Email or password is wrong.";
  }
  if (normalized === "MissingCSRF" || /csrf/i.test(normalized)) {
    return "Session expired. Refresh the page (F5) and sign in again.";
  }
  return normalized;
}

function resolveCallbackUrl() {
  if (typeof window === "undefined") return "/Page/dashboard";
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("callbackUrl");
  if (!raw) return "/Page/dashboard";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/Page/dashboard";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/Page/dashboard";
  }
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
    const reason = params.get("reason");
    if (reason === "session_expired") {
      setErrorMsg("Session expired after 2 hours offline. Please sign in again.");
    } else if (err) {
      setErrorMsg(mapSignInError(err));
    }
    if (err || reason || params.has("callbackUrl")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const runSignIn = useCallback(async () => {
    setErrorMsg("");
    setIsLoading(true);
    try {
      const trimmedEmail = String(email || "").trim();
      const pwd = String(password || "");
      if (!trimmedEmail || !pwd) {
        setErrorMsg("Please enter email and password");
        return;
      }

      const callbackUrl = resolveCallbackUrl();
      const res = await signIn("credentials", {
        redirect: false,
        email: trimmedEmail,
        password: pwd,
        callbackUrl,
      });

      if (res?.error) {
        setErrorMsg(mapSignInError(res.error));
        return;
      }

      if (res?.ok === false) {
        setErrorMsg("Sign in failed. Please try again.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("[CLIENT] signIn error:", err);
      setErrorMsg("Error, please try again in 1 minute");
    } finally {
      setIsLoading(false);
    }
  }, [email, password, router]);

  const handleEnterKey = (e) => {
    if (e.key !== "Enter" || isLoading) return;
    e.preventDefault();
    void runSignIn();
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-7">
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleEnterKey}
            required
            autoComplete="email"
            disabled={isLoading}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#2b4f82] focus:ring-2 focus:ring-[#2b4f82]/25 disabled:opacity-60"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleEnterKey}
              required
              autoComplete="current-password"
              disabled={isLoading}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-4 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#2b4f82] focus:ring-2 focus:ring-[#2b4f82]/25 disabled:opacity-60"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#2b4f82]/40 disabled:opacity-60"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden />
              ) : (
                <Eye className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void runSignIn()}
          disabled={isLoading}
          className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#141D38] to-[#2b4f82] px-4 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}
