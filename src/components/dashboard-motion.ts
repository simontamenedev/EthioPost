import type { Variants } from "framer-motion";

export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
export const rise: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } } };

/* shared surface for every card: white / deep-navy in dark mode */
export const cardSurface =
  "rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 transition-colors dark:border-white/10 dark:bg-[#161a5c] dark:shadow-none";
