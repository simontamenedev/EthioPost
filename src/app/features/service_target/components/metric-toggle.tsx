import { PerformanceMetric } from "../../../../lib/api/types";
import { cn } from "../../../../lib/utils";


export function MetricToggle({
  value,
  onChange,
}: {
  value: PerformanceMetric;
  onChange: (m: PerformanceMetric) => void;
}) {
  return (
    <div role="group" aria-label="Metric" className="inline-flex border border-slate-200 p-0.5 dark:border-white/15">
      {(["amount", "count"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "px-3 py-1 text-xs font-semibold transition",
            value === m
              ? "bg-[#2c317b] text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10",
          )}
        >
          {m === "amount" ? "Amount" : "Count"}
        </button>
      ))}
    </div>
  );
}