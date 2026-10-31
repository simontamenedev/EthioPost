"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cardSurface } from "./dashboard-motion";

type Entry = { name: string; records: number; commission: number };

type Props = {
  title: string;
  /** singular noun, e.g. "agent" */
  noun: string;
  icon: LucideIcon;
  entries: Entry[];
  total: number;
  limit?: number;
};

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plural = (n: number, noun: string) => `${n.toLocaleString()} ${noun}${n === 1 ? "" : noun.endsWith("ch") ? "es" : "s"}`;

/* Ranked horizontal bars with staggered grow-in. Rank 1 is gold. */
export function RankedBars({ title, noun, icon: Icon, entries, total, limit = 6 }: Props) {
  const sorted = [...entries].sort((a, b) => b.commission - a.commission);
  const top = sorted.slice(0, limit);
  const max = top[0]?.commission ?? 0;

  return (
    <section className={`${cardSurface} h-full p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#2c317b]/10 text-[#2c317b] dark:bg-[#f3ad1c]/15 dark:text-[#f3ad1c]"><Icon size={19} /></span>
          <div>
            <h2 className="font-semibold text-[#2c317b] dark:text-white">{title}</h2>
            <p className="text-xs text-slate-600 dark:text-white/65">Top {top.length} of {plural(sorted.length, noun)} by commission</p>
          </div>
        </div>
        <Link href="/reports" aria-label={`View ${noun} report`} className="group rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#2c317b] focus-visible:outline-2 focus-visible:outline-[#2c317b] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-[#f3ad1c] dark:focus-visible:outline-[#f3ad1c]">
          <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <ol className="mt-5 space-y-2">
        {top.map((e, i) => {
          const pct = max > 0 ? (e.commission / max) * 100 : 0;
          const share = total > 0 ? Math.round((e.commission / total) * 1000) / 10 : 0;
          return (
            <motion.li
              key={e.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.15 + i * 0.06 }}
              className="grid grid-cols-[28px_1fr] items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <span className={`flex size-7 items-center justify-center rounded-lg text-xs font-bold ${i === 0 ? "bg-[#f3ad1c] text-[#2c317b]" : "bg-[#2c317b]/10 text-[#2c317b] dark:bg-white/10 dark:text-white"}`}>{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{e.name}</p>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-[#2c317b] dark:text-white">{money.format(e.commission)}</p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.25 + i * 0.06, ease: "easeOut" }}
                    className={`h-full rounded-full ${i === 0 ? "bg-[#f3ad1c]" : "bg-[#2c317b] dark:bg-[#9193a7]"}`}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-white/65">{e.records.toLocaleString()} record{e.records === 1 ? "" : "s"} · {share}% of total</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
