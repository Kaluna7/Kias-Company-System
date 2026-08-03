import Image from "next/image";
import AuthForm from "./AuthForm";

const FEATURES = [
  {
    title: "Progress & schedule",
    body: "Pantau status modul per department dalam satu dashboard",
  },
  {
    title: "Temuan & evidence",
    body: "Kelola SOP, worksheet, finding, dan lampiran audit",
  },
  {
    title: "Report terpadu",
    body: "Susun dan terbitkan laporan internal audit",
  },
];

export default function AuthPageShell({ callbackUrl }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#eef3fb] via-[#f5f7fc] to-[#e8eef9] px-4 py-10 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-[#d7e1f2] bg-white shadow-2xl md:grid-cols-2">
          <div className="relative hidden flex-col justify-between border-r border-[#e3e9f5] bg-gradient-to-br from-[#141D38] to-[#223f68] p-10 text-white md:flex">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src="/images/kias-logo.webp"
                  alt="KIAS"
                  width={56}
                  height={56}
                  priority
                  className="rounded-xl bg-white/10 p-1"
                  style={{ width: 56, height: 56, objectFit: "contain" }}
                />
                <div>
                  <p className="text-xl font-bold tracking-tight">KIAS</p>
                  <p className="text-xs text-blue-100/90">PT KPU Internal Audit System</p>
                </div>
              </div>

              <p className="mt-8 text-sm font-medium uppercase tracking-[0.18em] text-blue-200/80">
                Internal audit
              </p>
              <h1 className="mt-3 text-3xl font-bold leading-tight">
                Audit teratur, operasional jelas.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-blue-100/90">
                Satu konsol untuk preparer, reviewer, dan super admin — jadwal, temuan, evidence, dan
                report dalam satu alur kerja.
              </p>

              <ul className="mt-8 space-y-3">
                {FEATURES.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-blue-100/85">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-10 text-xs text-blue-100/70">
              © 2026 KIAS · PT Karya Prima Unggulan
            </p>
          </div>

          <div className="flex items-center justify-center bg-white p-6 sm:p-8 md:p-12">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center md:text-left">
                <div className="mb-4 flex justify-center md:hidden">
                  <Image
                    src="/images/kias-logo.webp"
                    alt="KIAS"
                    width={64}
                    height={64}
                    priority
                    style={{ width: 64, height: 64, objectFit: "contain" }}
                  />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2b4f82]">
                  KIAS Portal
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">Sign In</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Masuk dengan email dan password akun Anda.
                </p>
              </div>
              <AuthForm callbackUrl={callbackUrl} />
              <p className="mt-5 text-center text-xs text-slate-500 md:text-left">
                © 2026 KIAS. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
