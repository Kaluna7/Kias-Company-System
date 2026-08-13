import Image from "next/image";
import AuthForm from "./AuthForm";
import { Lock, Scale, ShieldCheck, Target, UserCheck } from "lucide-react";

const VALUE_CARDS = [
  {
    title: "INTEGRITY",
    body: "Honesty, transparency, and ethical behavior in every audit activity.",
    icon: Scale,
    iconColor: "#fbbf24",
    iconBg: "rgba(251, 191, 36, 0.2)",
  },
  {
    title: "OBJECTIVITY",
    body: "Unbiased and independent judgment in every conclusion.",
    icon: Target,
    iconColor: "#60a5fa",
    iconBg: "rgba(96, 165, 250, 0.2)",
  },
  {
    title: "CONFIDENTIALITY",
    body: "Audit information is protected for Internal Audit use only.",
    icon: Lock,
    iconColor: "#c084fc",
    iconBg: "rgba(192, 132, 252, 0.2)",
  },
  {
    title: "ACCOUNTABILITY",
    body: "We own our work and ensure quality follow-through.",
    icon: UserCheck,
    iconColor: "#34d399",
    iconBg: "rgba(52, 211, 153, 0.2)",
  },
];

export default function AuthPageShell({ callbackUrl }) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden md:h-screen md:overflow-hidden">
      <Image
        src="/images/bg-kias.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div aria-hidden className="absolute inset-0 bg-[#050a18]/50" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-3 py-4 sm:px-5 md:h-full md:min-h-0 md:px-6 md:py-5 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[24px] border border-white/15 bg-[#07111f]/45 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-sm md:h-[min(100%,780px)] md:grid-cols-2 lg:rounded-[28px]">
          {/* Left branding */}
          <div className="relative hidden min-h-0 flex-col overflow-hidden text-white md:flex">
            <Image
              src="/images/bg-kias.png"
              alt=""
              fill
              priority
              sizes="50vw"
              className="object-cover object-center"
            />
            <div aria-hidden className="absolute inset-0 bg-[#050a18]/65" />
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(37,99,235,0.32),transparent_48%)]"
            />

            <div className="relative z-10 flex h-full min-h-0 flex-col gap-3 p-6 lg:gap-4 lg:p-8">
              <div className="shrink-0">
                <Image
                  src="/images/auth-logo-v2.png"
                  alt="KIAS — PT KPU Internal Audit System"
                  width={160}
                  height={53}
                  priority
                  className="h-auto w-[120px] object-contain lg:w-[140px]"
                />
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-sky-300" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                  Internal Audit
                </span>
              </div>

              <h1 className="shrink-0 max-w-xl text-[1.35rem] font-bold leading-snug tracking-tight lg:text-[1.65rem]">
                <span className="text-[#38bdf8]">INTEGRITY.</span> OBJECTIVITY.
                <br />
                CONFIDENTIALITY. ACCOUNTABILITY.
              </h1>

              <p className="hidden max-w-lg shrink-0 text-[13px] leading-5 text-blue-50/85 xl:block">
                A controlled audit environment designed to protect independence, strengthen
                assurance, and preserve the integrity of every audit process.
              </p>

              <ul className="grid shrink-0 grid-cols-2 content-start gap-2.5 lg:gap-3">
                {VALUE_CARDS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.title}
                      className="relative flex flex-col rounded-2xl border border-white/20 bg-[rgba(8,16,32,0.58)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl lg:p-3.5"
                    >
                      <div
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full lg:h-10 lg:w-10"
                        style={{
                          backgroundColor: item.iconBg,
                          boxShadow: `0 0 0 1px ${item.iconColor}40`,
                        }}
                      >
                        <Icon className="h-4 w-4 lg:h-[18px] lg:w-[18px]" style={{ color: item.iconColor }} />
                      </div>
                      <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-white lg:text-[12px]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[10px] leading-[1.4] text-slate-200/80 lg:text-[11px]">
                        {item.body}
                      </p>
                      <div
                        aria-hidden
                        className="mt-2.5 h-[3px] w-8 rounded-full"
                        style={{ backgroundColor: item.iconColor }}
                      />
                    </li>
                  );
                })}
              </ul>

              <div className="flex shrink-0 justify-center pt-1">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur-md">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                  <p className="truncate text-[10px] font-medium text-blue-50/90 lg:text-[11px]">
                    Protecting Information. Strengthening Assurance. Adding Value.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right login */}
          <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto bg-white px-5 py-8 sm:px-8 md:min-h-0 md:overflow-hidden md:px-10 md:py-8">
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
              className="pointer-events-none absolute -right-8 -top-6 hidden h-48 w-48 text-slate-200/70 sm:block"
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
                    src="/images/auth-logo-v2.png"
                    alt="KIAS — PT KPU Internal Audit System"
                    width={140}
                    height={46}
                    priority
                    className="h-auto w-[120px] object-contain"
                  />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2563eb]">
                  KIAS Portal
                </p>
                <h2 className="mt-2 text-[1.75rem] font-bold tracking-tight text-slate-900 sm:text-[2rem]">
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
