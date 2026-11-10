"use client";

import { useState } from "react";
import { cn } from "../../../../lib/utils";
import { card } from "../../analytics/styles/styles";

// Mid-tone colours that stay readable on both white and dark backgrounds.
export const PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

export type Slice = { key: string; label: string; value: number; color?: string };

const R = 40;
const C = 2 * Math.PI * R;

export function DonutChart({
  title, subtitle, slices, format, centerLabel, className,
}: {
  title: string;
  subtitle?: string;
  slices: Slice[];
  format: (n: number) => string;
  centerLabel?: string;
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const data = slices
    .filter((s) => s.value > 0)
    .map((s, i) => ({ ...s, color: s.color ?? PALETTE[i % PALETTE.length] }));
  const total = data.reduce((sum, s) => sum + s.value, 0);
  const current = data.find((s) => s.key === active);

  let offset = 0;
  return (
    <div className={cn(card, className)}>
      <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 dark:text-white/60">{subtitle}</p>}

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-white/60">No data for this period</p>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-4">
          <svg viewBox="0 0 100 100" className="h-40 w-40" role="img" aria-label={title}>
            <circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" className="stroke-slate-100 dark:stroke-white/10" />
            {data.map((s) => {
              const len = (s.value / total) * C;
              const el = (
                <circle
                  key={s.key}
                  cx="50" cy="50" r={R} fill="none"
                  stroke={s.color}
                  strokeWidth={active === s.key ? 16 : 14}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  opacity={active && active !== s.key ? 0.35 : 1}
                  onMouseEnter={() => setActive(s.key)}
                  onMouseLeave={() => setActive(null)}
                  className="cursor-pointer transition-all"
                >
                  <title>{`${s.label}: ${format(s.value)} (${((s.value / total) * 100).toFixed(1)}%)`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
            <text x="50" y="47" textAnchor="middle" className="fill-slate-500 text-[5px] dark:fill-white/60">
              {current ? current.label.slice(0, 16) : (centerLabel ?? "Total")}
            </text>
            <text x="50" y="57" textAnchor="middle" className="fill-slate-900 text-[8px] font-bold dark:fill-white">
              {format(current ? current.value : total)}
            </text>
          </svg>

          <ul className="w-full space-y-1.5 text-sm">
            {data.map((s) => (
              <li
                key={s.key}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate text-slate-800 dark:text-white/90">{s.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-slate-500 dark:text-white/60">
                  {((s.value / total) * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}