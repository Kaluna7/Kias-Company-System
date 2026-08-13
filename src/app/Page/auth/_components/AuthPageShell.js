import Image from "next/image";
import AuthForm from "./AuthForm";
import { Lock, Scale, ShieldCheck, Target, UserCheck } from "lucide-react";

const VALUE_CARDS = [
  {
    title: "INTEGRITY",
    body: "We uphold honesty, transparency, and ethical behavior in every audit activity.",
    icon: Scale,
    iconColor: "#fbbf24",
    iconBg: "rgba(251, 191, 36, 0.2)",
  },
  {
    title: "OBJECTIVITY",
    body: "We remain unbiased and independent in our judgment and conclusions.",
    icon: Target,
    iconColor: "#60a5fa",
    iconBg: "rgba(96, 165, 250, 0.2)",
  },
  {
    title: "CONFIDENTIALITY",
    body: "We protect information and store all audit information strictly for Internal Audit use only.",
    icon: Lock,
    iconColor: "#c084fc",
    iconBg: "rgba(192, 132, 252, 0.2)",
  },
  {
    title: "ACCOUNTABILITY",
    body: "We take responsibility for our work and ensure audit quality and follow-through.",
    icon: UserCheck,
    iconColor: "#34d399",
    iconBg: "rgba(52, 211, 153, 0.2)",
  },
];

export default function AuthPageShell({ callbackUrl }) {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <Image
        src="/images/bg-kias.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div aria-hidden className="absolute inset-0 bg-[#050a18]/45" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center px-4 py-5 md:px-6 lg:px-8">
        {/* One classy split card — like mockup */}
        <div className="grid h-full max-h-[860px] w-full overflow-hidden rounded-[28px] border border-white/15 bg-[#07111f]/40 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-sm md:grid-cols-[1.05fr_0.95fr]">
          {/* Left panel */}
          <div className="relative hidden h-full min-h-0 flex-col overflow-hidden p-8 text-white md:flex lg:p-10">
            <Image
              src="/images/bg-kias.png"
              alt=""
              fill
              priority
              sizes="50vw"
              className="object-cover object-center"
            />
            <div aria-hidden className="absolute inset-0 bg-[#050a18]/62" />
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(37,99,235,0.35),transparent_48%)]"
            />

            <div className="relative z-10 flex h-full min-h-0 flex-col">
              <div className="flex items-center">
                <Image
                  src="/images/auth-logo.png"
                  alt="KIAS — PT KPU Internal Audit System"
                  width={220}
                  height={72}
                  priority
                  className="h-auto w-[180px] object-contain lg:w-[210px]"
                />
              </div>

              <div className="mt-7 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-sky-300" />
                <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white">
                  Internal Audit
                </span>
              </div>

              <h1 className="mt-4 max-w-xl text-[1.7rem] font-bold leading-[1.22] tracking-tight lg:text-[1.95rem]">
                <span className="text-[#38bdf8]">INTEGRITY.</span> OBJECTIVITY.
                <br />
                CONFIDENTIALITY. ACCOUNTABILITY.
              </h1>

              <p className="mt-4 max-w-lg text-[13.5px] leading-6 text-blue-50/85">
                A controlled audit environment designed to protect independence, strengthen
                assurance, and preserve the integrity of every audit process.
              </p>

              {/* Classy glass value cards */}
              <ul className="mt-6 grid min-h-0 flex-1 grid-cols-2 content-start gap-3.5">
                {VALUE_CARDS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.title}
                      className="group relative flex min-h-[138px] flex-col overflow-hidden rounded-[18px] border border-white/20 bg-[rgba(8,16,32,0.55)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/35 hover:bg-[rgba(10,20,40,0.7)]"
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70"
                        style={{ backgroundColor: item.iconColor }}
                      />
                      <div
                        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: item.iconBg,
                          boxShadow: `0 0 0 1px ${item.iconColor}40, 0 8px 18px ${item.iconColor}22`,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: item.iconColor }} />
                      </div>
                      <p className="relative mt-3 text-[12px] font-bold uppercase tracking-[0.08em] text-white">
                        {item.title}
                      </p>
                      <p className="relative mt-1.5 flex-1 text-[11px] leading-[1.4] text-slate-200/75">
                        {item.body}
                      </p>
                      <div
                        aria-hidden
                        className="relative mt-3 h-[3px] w-10 rounded-full"
                        style={{
                          backgroundColor: item.iconColor,
                          boxShadow: `0 0 10px ${item.iconColor}80`,
                        }}
                      />
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 backdrop-blur-md">
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
                  <p className="text-[11px] font-medium text-blue-50/90">
                    Protecting Information. Strengthening Assurance. Adding Value.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right login panel */}
          <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-white px-6 py-8 sm:px-8 md:px-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 100% 0%, rgba(37,99,235,0.08), transparent 40%)",
              }}
            />
            <svg
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-6 h-48 w-48 text-slate-200/70"
              viewBox="0 0 160 160"
              fill="none"
            >
              <circle cx="110" cy="40" r="54" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="110" cy="40" r="38" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="110" cy="40" r="22" stroke="currentColor" strokeWidth="1.2" />
            </svg>

            <div className="relative z-10 w-full max-w-[380px]">
              <div className="mb-6 text-center md:text-left">
                <div className="mb-4 flex justify-center md:hidden">
                  <Image
                    src="/images/auth-logo.png"
                    alt="KIAS — PT KPU Internal Audit System"
                    width={180}
                    height={60}
                    priority
                    className="h-auto w-[160px] object-contain"
                  />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2563eb]">
                  KIAS Portal
                </p>
                <h2 className="mt-2 text-[2rem] font-bold tracking-tight text-slate-900">
                  Welcome Back <span aria-hidden>👋</span>
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Sign in to continue to your account
                </p>
              </div>

              <AuthForm callbackUrl={callbackUrl} />

              <div className="mt-6 flex items-center justify-center gap-2 text-[12px] font-medium text-slate-500">
                <ShieldCheck className="h-4 w-4 text-[#2563eb]" />
                Secure
                <span className="text-slate-300">•</span>
                Controlled
                <span className="text-slate-300">•</span>
                Trusted
              </div>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                © 2026 KIAS. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
