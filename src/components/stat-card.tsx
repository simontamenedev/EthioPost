"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { CountUp } from "./count-up";
import { cardSurface, rise } from "./dashboard-motion";

type Props = {
  label: string;
  value: number;
  decimals?: number;
  unit?: string;
  note: string;
  icon: LucideIcon;
  /** the headline metric: Post Finance Blue card with gold icon */
  hero?: boolean;
};

export function StatCard({ label, value, decimals = 0, unit, note, icon: Icon, hero = false }: Props) {
  return (
    <motion.article
      variants={rise}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`relative overflow-hidden p-5 ${hero ? "rounded-2xl bg-[#2c317b] text-white shadow-lg shadow-[#2c317b]/25" : cardSurface}`}
    >
      <div className={`flex size-11 items-center justify-center rounded-xl ${hero ? "bg-white/10 text-[#f3ad1c]" : "bg-[#2c317b]/10 text-[#2c317b] dark:bg-[#f3ad1c]/15 dark:text-[#f3ad1c]"}`}>
        <Icon size={20} strokeWidth={1.9} />
      </div>
      <p className={`mt-5 text-sm font-medium ${hero ? "text-white/80" : "text-slate-600 dark:text-white/70"}`}>{label}</p>
      <p className={`mt-1 flex items-baseline gap-1.5 text-3xl font-bold tracking-tight ${hero ? "text-white" : "text-[#2c317b] dark:text-white"}`}>
        <CountUp value={value} decimals={decimals} />
        {unit && <span className={`text-sm font-semibold ${hero ? "text-[#f3ad1c]" : "text-slate-500 dark:text-white/60"}`}>{unit}</span>}
      </p>
      <p className={`mt-1 text-xs ${hero ? "text-white/75" : "text-slate-600 dark:text-white/65"}`}>{note}</p>
    </motion.article>
  );
}
