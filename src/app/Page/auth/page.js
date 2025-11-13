"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useUserStore from "@/app/stores/useStore"; // ← tambahkan ini

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const setUser = useUserStore((state) => state.setUser); // ✅ ambil setter

  const handleLogin = async (e) => {
    e?.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      if (!email.trim() || !password) {
        setErrorMsg("Please enter email and password");
        setIsLoading(false);
        return;
      }

      console.log("[CLIENT] attempting signIn with:", { email });

      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
      });

      console.log("[CLIENT] signIn result:", res);

      if (res?.error) {
        setErrorMsg(res.error || "Invalid credentials");
      } else {
        // ✅ Ambil session user dari NextAuth
        const session = await getSession();

        // Misalnya session.user = { name, email, role }
        if (session?.user) {
          setUser(session.user); // ✅ simpan ke store
          console.log("[AUTH] user stored:", session.user);
        }

        // redirect ke dashboard
        router.push("/Page/dashboard");
      }
    } catch (err) {
      console.error("[CLIENT] signIn error:", err);
      setErrorMsg("An error occurred. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
      <div className="text-center">
        <h1 className="font-bold text-4xl text-gray-800 mb-2">Welcome Back</h1>
        <p className="text-gray-600">Sign in to your account</p>
      </div>

      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              placeholder="Enter your password"
            />
          </div>

          {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-600 transition-all disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </div>
  );
}
