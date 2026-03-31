"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthFormClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

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
        setErrorMsg(res.error || "Invalid credentials");
        return;
      }

      router.push("/Page/dashboard");
      router.refresh();
    } catch (err) {
      console.error("[CLIENT] signIn error:", err);
      setErrorMsg("An error occurred. Try again.");
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
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#2b4f82] focus:ring-2 focus:ring-[#2b4f82]/25"
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-gradient-to-r from-[#141D38] to-[#2b4f82] px-4 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </form>
  );
}


