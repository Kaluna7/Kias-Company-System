import AuthFormClient from "./_components/AuthFormClient";
import Image from "next/image";

export default function AuthPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#eef3fb] via-[#f5f7fc] to-[#e8eef9] px-4 py-10 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-[#d7e1f2] bg-white shadow-2xl md:grid-cols-2">
          <div className="relative hidden flex-col justify-between border-r border-[#e3e9f5] bg-gradient-to-br from-[#141D38] to-[#223f68] p-10 text-white md:flex">
            <div>
              <Image src="/images/kias-logo.webp" alt="KIAS logo" width={180} height={180} priority />
              <p className="mt-6 text-sm text-blue-100">PT KPU Internal Audit System</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight">
                Welcome back to your internal audit workspace.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-blue-100/90">
                Sign in to continue reviewing findings, monitoring progress, and publishing reports across departments.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-blue-100">
              Secure access is restricted to authorized team members only.
            </div>
          </div>

          <div className="flex items-center justify-center bg-white p-6 sm:p-8 md:p-12">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center md:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2b4f82]">KIAS Portal</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">Sign In</h2>
                <p className="mt-2 text-sm text-slate-600">Use your account credentials to access the dashboard.</p>
              </div>
              <AuthFormClient />
              <p className="mt-5 text-center text-xs text-slate-500 md:text-left">Copyright 2026 KIAS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
