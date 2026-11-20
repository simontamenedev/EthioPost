import type { ReactNode } from "react";
import { cn } from "../../../../lib/utils";

export type Tone = "blue" | "gold" | "blue2" | "gold2" | "blue3" | "gold3" | "muted";

// Brand colours only. Class names are written out in full so Tailwind can see them.
const TONES: Record<Tone, { stroke: string; bg: string }> = {
  blue: { stroke: "stroke-[#2c317b] dark:stroke-white", bg: "bg-[#2c317b] dark:bg-white" },
  gold: { stroke: "stroke-[#f3ad1c]", bg: "bg-[#f3ad1c]" },
  blue2: { stroke: "stroke-[#666893] dark:stroke-[#9193a7]", bg: "bg-[#666893] dark:bg-[#9193a7]" },
  gold2: { stroke: "stroke-[#f3c370]", bg: "bg-[#f3c370]" },
  blue3: { stroke: "stroke-[#9193a7] dark:stroke-[#666893]", bg: "bg-[#9193a7] dark:bg-[#666893]" },
  gold3: { stroke: "stroke-[#f3c981]", bg: "bg-[#f3c981]" },
  muted: { stroke: "stroke-slate-200 dark:stroke-white/15", bg: "bg-slate-200 dark:bg-white/15" },
};

const SERIES: Tone[] = ["blue", "gold", "blue2", "gold2", "blue3", "gold3"];
export const toneAt = (i: number): Tone => SERIES[i % SERIES.length];
export const toneBg = (tone: Tone) => TONES[tone].bg;

export type Slice = { label: string; value: number; tone: Tone };

export function DonutChart({
  slices,
  size = 112,
  thickness = 14,
  center,
  label,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
  label: string;
}) {
  const mid = size / 2;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={thickness} className={TONES.muted.stroke} />
        <g transform={`rotate(-90 ${mid} ${mid})`}>
          {total > 0 &&
            positive.map((s) => {
              const len = (s.value / total) * c;
              const circle = (
                <circle
                  key={s.label}
                  cx={mid}
                  cy={mid}
                  r={r}
                  fill="none"
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  className={TONES[s.tone].stroke}
                />
              );
              offset += len;
              return circle;
            })}
        </g>
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; value: ReactNode; tone: Tone }[] }) {
  return (
    <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className={cn("size-2.5 shrink-0", TONES[i.tone].bg)} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-white/70">{i.label}</span>
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}