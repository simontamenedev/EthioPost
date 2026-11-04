"use client";

import { useState } from "react";
import { cn } from "../../../../lib/utils";
import { inputBase, focusRing } from "../../../../components/ui/styles";
import { DateRange, PresetKey, presetRange, PRESETS } from "../lib/date-range";

type Props = { value: DateRange; onChange: (next: DateRange) => void; defaultPreset?: PresetKey };

/** Preset chips + custom from/to. Controlled: the page owns `value` and passes it to the hooks. */
export function DateRangeFilter({ value, onChange, defaultPreset = "last30" }: Props) {
  const [preset, setPreset] = useState<PresetKey>(defaultPreset);
  const invalid = !!value.date_from && !!value.date_to && value.date_from > value.date_to;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => { setPreset(p.key); onChange(presetRange(p.key)); }}
            className={cn(
              "h-10 rounded-xl border px-3.5 text-sm font-medium transition",
              preset === p.key
                ? "border-[#2c317b] bg-[#2c317b] text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10",
              focusRing,
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            value={value.date_from ?? ""}
            onChange={(e) => { setPreset("custom"); onChange({ ...value, date_from: e.target.value || undefined }); }}
            className={cn(inputBase, "h-10 w-40")}
          />
          <span className="text-sm text-slate-500 dark:text-white/60">to</span>
          <input
            type="date"
            aria-label="To date"
            value={value.date_to ?? ""}
            onChange={(e) => { setPreset("custom"); onChange({ ...value, date_to: e.target.value || undefined }); }}
            className={cn(inputBase, "h-10 w-40")}
          />
        </div>
      </div>
      {invalid && <p className="text-sm text-red-600 dark:text-red-300">“From” must be on or before “To”.</p>}
    </div>
  );
}
