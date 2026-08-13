"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function PasswordField() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
        Password
      </label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
          placeholder="Enter your password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#2563eb]/40"
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
  );
}
