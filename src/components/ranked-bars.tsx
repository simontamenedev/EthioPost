"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
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

const GOLD = "#f3ad1c";
const NAVY = "#2c317b";

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const plural = (n: number, noun: string) =>
  `${n.toLocaleString()} ${noun}${n === 1 ? "" : noun.endsWith("ch") ? "es" : "s"}`;
const clip = (s: string, n = 12) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Row = Entry & { rank: number; share: number };

/** X-axis label: shortened, slightly rotated so neighbours don't collide. */
function Tick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={10}
        textAnchor="end"
        transform="rotate(-30)"
        className="fill-slate-600 text-[11px] dark:fill-white/65"
      >
        {clip(payload?.value ?? "")}
      </text>
    </g>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/15 dark:bg-[#161a5c]">
      <p className="max-w-[220px] font-semibold text-slate-800 dark:text-white">
        #{r.rank} · {r.name}
      </p>
      <p className="mt-1 font-bold tabular-nums text-[#2c317b] dark:text-[#f3ad1c]">{money.format(r.commission)} ETB</p>
      <p className="mt-0.5 text-slate-600 dark:text-white/65">
        {r.records.toLocaleString()} record{r.records === 1 ? "" : "s"} · {r.share}% of total
      </p>
    </div>
  );
}

/* Column chart of the top entries by commission. Rank 1 is gold. */
export function RankedBars({ title, noun, icon: Icon, entries, total, limit = 6 }: Props) {
  const sorted = [...entries].sort((a, b) => b.commission - a.commission);
  const data: Row[] = sorted.slice(0, limit).map((e, i) => ({
    ...e,
    rank: i + 1,
    share: total > 0 ? Math.round((e.commission / total) * 1000) / 10 : 0,
  }));

  return (
    <section className={`${cardSurface} h-full p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#2c317b]/10 text-[#2c317b] dark:bg-[#f3ad1c]/15 dark:text-[#f3ad1c]"><Icon size={19} /></span>
          <div>
            <h2 className="font-semibold text-[#2c317b] dark:text-white">{title}</h2>
            <p className="text-xs text-slate-600 dark:text-white/65">Top {data.length} of {plural(sorted.length, noun)} by commission (ETB)</p>
          </div>
        </div>
        <Link href="/reports" aria-label={`View ${noun} report`} className="group rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#2c317b] focus-visible:outline-2 focus-visible:outline-[#2c317b] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-[#f3ad1c] dark:focus-visible:outline-[#f3ad1c]">
          <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      {data.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-white/60">No data for this period.</p>
      ) : (
        <div className="mt-5 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
              <XAxis dataKey="name" interval={0} tickLine={false} axisLine={false} tick={<Tick />} height={56} />
              <YAxis
                width={48}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => compact.format(v)}
                tick={{ fontSize: 11 }}
                className="fill-slate-600 dark:fill-white/65"
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(44,49,123,0.06)" }} />
              <Bar dataKey="commission" radius={[6, 6, 0, 0]} maxBarSize={48} animationDuration={700}>
                {data.map((r) => (
                  <Cell key={`${r.rank}-${r.name}`} fill={r.rank === 1 ? GOLD : NAVY} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}