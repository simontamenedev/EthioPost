"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MapPinned } from "lucide-react";
import { cardSurface } from "./dashboard-motion";

type Entry = { name: string; records: number; commission: number };

/* Brand palette, with lighter tints in dark mode so every slice stays visible */
const palette = [
  { stroke: "stroke-[#2c317b] dark:stroke-[#9193a7]", dot: "bg-[#2c317b] dark:bg-[#9193a7]" },
  { stroke: "stroke-[#f3ad1c]", dot: "bg-[#f3ad1c]" },
  { stroke: "stroke-[#52558a] dark:stroke-[#7b7c9c]", dot: "bg-[#52558a] dark:bg-[#7b7c9c]" },
  { stroke: "stroke-[#f3be5d] dark:stroke-[#f3c981]", dot: "bg-[#f3be5d] dark:bg-[#f3c981]" },
  { stroke: "stroke-[#7b7c9c] dark:stroke-[#666893]", dot: "bg-[#7b7c9c] dark:bg-[#666893]" },
  { stroke: "stroke-slate-300 dark:stroke-white/30", dot: "bg-slate-300 dark:bg-white/30" },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const R = 40;
const C = 2 * Math.PI * R;

/* Share of commission by district: top 5 + "Other". Hover a slice or legend row to inspect. */
export function DistrictDonut({ entries, total }: { entries: Entry[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);

  const sorted = [...entries].sort((a, b) => b.commission - a.commission);
  const head = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const slices = rest.length
    ? [...head, { name: `Other (${rest.length})`, records: rest.reduce((s, e) => s + e.records, 0), commission: rest.reduce((s, e) => s + e.commission, 0) }]
    : head;

  let acc = 0;
  const arcs = slices.map((s, i) => {
    const frac = total > 0 ? s.commission / total : 0;
    const start = acc;
    acc += frac;
    const gap = slices.length > 1 ? 1.4 : 0;
    return { ...s, i, frac, rotate: start * 360 - 90, len: Math.max(frac * C - gap, 0) };
  });

  const active = hover !== null ? arcs[hover] : null;

  return (
    <section className={`${cardSurface} h-full p-5 sm:p-6`}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#2c317b]/10 text-[#2c317b] dark:bg-[#f3ad1c]/15 dark:text-[#f3ad1c]"><MapPinned size={19} /></span>
        <div>
          <h2 className="font-semibold text-[#2c317b] dark:text-white">Commission by district</h2>
          <p className="text-xs text-slate-600 dark:text-white/65">{sorted.length} district{sorted.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="relative mx-auto mt-5 aspect-square w-full max-w-[220px]">
        <svg viewBox="0 0 100 100" role="img" aria-label="Commission share by district" className="size-full">
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" className="stroke-slate-100 dark:stroke-white/10" />
          {arcs.map((a) => (
            <g key={a.name} transform={`rotate(${a.rotate} 50 50)`}>
              <motion.circle
                cx="50" cy="50" r={R} fill="none" strokeWidth={hover === a.i ? 16 : 14}
                className={`${palette[a.i % palette.length].stroke} cursor-pointer transition-[stroke-width,opacity] duration-200`}
                style={{ opacity: hover === null || hover === a.i ? 1 : 0.35 }}
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: `${a.len} ${C - a.len}` }}
                transition={{ duration: 0.8, delay: 0.2 + a.i * 0.12, ease: "easeOut" }}
                onMouseEnter={() => setHover(a.i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <AnimatePresence mode="wait">
            <motion.div key={active?.name ?? "total"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="max-w-[110px]">
              <p className="truncate text-[11px] font-medium text-slate-600 dark:text-white/70">{active ? active.name : "Total"}</p>
              <p className="text-xl font-bold tabular-nums text-[#2c317b] dark:text-white">{compact.format(active ? active.commission : total)}</p>
              {active && <p className="text-[11px] font-semibold text-slate-600 dark:text-white/70">{Math.round(active.frac * 1000) / 10}%</p>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ul className="mt-5 space-y-1">
        {arcs.map((a) => (
          <motion.li
            key={a.name}
            tabIndex={0}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + a.i * 0.05 }}
            onMouseEnter={() => setHover(a.i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(a.i)}
            onBlur={() => setHover(null)}
            className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2c317b] dark:focus-visible:ring-[#f3ad1c] ${hover === a.i ? "bg-slate-100 dark:bg-white/10" : ""}`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={`size-2.5 shrink-0 rounded-full ${palette[a.i % palette.length].dot}`} />
              <span className="truncate font-medium text-slate-800 dark:text-white">{a.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-700 dark:text-white/80">
              <span className="font-semibold">{compact.format(a.commission)}</span>
              <span className="ml-2 text-xs text-slate-600 dark:text-white/65">{Math.round(a.frac * 1000) / 10}%</span>
            </span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
