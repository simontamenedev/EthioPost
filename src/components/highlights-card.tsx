"use client";

import { motion } from "framer-motion";
import { Crown, type LucideIcon } from "lucide-react";

type Leader = { label: string; name?: string; commission: number; icon: LucideIcon };

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/* Leaders at a glance. Light: blue → #294896 gradient. Dark: deep navy → blue, matching the other dark cards. */
export function HighlightsCard({ leaders, total }: { leaders: Leader[]; total: number }) {
  return (
    <section className="h-full rounded-2xl border border-transparent bg-[#2c317b] [background-image:linear-gradient(135deg,#2c317b,#294896)] p-5 text-white shadow-lg shadow-[#2c317b]/25 transition-colors dark:border-white/10 dark:bg-[#161a5c] dark:[background-image:linear-gradient(135deg,#161a5c,#2c317b)] dark:shadow-none sm:p-6">
      <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-[#f3ad1c]"><Crown size={19} /></span>
      <h2 className="mt-4 font-semibold">Leaders</h2>
      <p className="text-xs text-white/75">Highest commission in each group</p>

      <ul className="mt-5 space-y-3">
        {leaders.map(({ label, name, commission, icon: Icon }, i) => {
          const share = total > 0 ? Math.round((commission / total) * 1000) / 10 : 0;
          return (
            <motion.li
              key={label}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.25 + i * 0.1 }}
              whileHover={{ x: 3 }}
              className="rounded-xl bg-white/10 p-3.5 transition-colors hover:bg-white/15 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <p className="flex items-center gap-2 text-xs font-medium text-white/75"><Icon size={14} className="text-[#f3ad1c]" /> {label}</p>
              <p className="mt-1 truncate text-sm font-bold">{name ?? "—"}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.8, delay: 0.4 + i * 0.1, ease: "easeOut" }} className="h-full rounded-full bg-[#f3ad1c]" />
                </div>
                <p className="shrink-0 text-xs tabular-nums text-white/80">{money.format(commission)} · {share}%</p>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
