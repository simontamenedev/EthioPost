import { focusRing } from "../../../../components/ui/styles";
import { cn } from "../../../../lib/utils";


/** Neutral button matching the edit/delete icon buttons in ResourceManager. */
export const secondaryButton = cn(
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition",
  "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
  "dark:border-white/15 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10",
  focusRing,
);

export const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5";
export const pageShell = "mx-auto w-full max-w-7xl space-y-5 px-5 py-8 sm:px-8 lg:px-10";
export const pageTitle = "text-2xl font-bold tracking-tight text-[#2c317b] dark:text-white";
export const pageDescription = "mt-1 text-sm text-slate-600 dark:text-white/70";