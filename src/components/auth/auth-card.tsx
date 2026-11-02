import type { InputHTMLAttributes, ReactNode } from "react";
import { Logo } from "../../app/features/login/components/brand-logo";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 dark:bg-[#0d1040]">
      <div className="w-full max-w-[420px] space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-[#2c317b]/10 dark:border-white/10 dark:bg-[#161a5c] dark:shadow-none p-4">
        <span className="block dark:hidden"><Logo variant="primary" className="h-10" /></span>
        <span className="hidden dark:block"><Logo variant="white" className="h-10" /></span>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-white/70">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

export function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-700 dark:text-white/80">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2c317b] focus:ring-4 focus:ring-[#2c317b]/15 dark:border-white/20 dark:bg-white/5 dark:text-white dark:focus:border-[#f3ad1c] dark:focus:ring-[#f3ad1c]/20"
      />
    </label>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const cls =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  return <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${cls}`}>{children}</p>;
}