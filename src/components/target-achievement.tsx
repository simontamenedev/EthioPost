"use client";

import { useState } from "react";
import { ChevronDown, Target } from "lucide-react";
import { useTargets } from "../app/features/service_target/hooks";
import { cn } from "../lib/utils";
import { useTargetPerformance } from "../app/features/analytics/hooks/use-analytics";
import { errorMessage } from "../lib/api/client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = (v: string | number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
const pct = (v: string | number | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);

const barColor = (p: number) => (p >= 100 ? "bg-emerald-500" : p >= 50 ? "bg-[#2c317b] dark:bg-white" : "bg-amber-500");

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
      <div className={cn("h-full rounded-full transition-[width]", barColor(value))} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function TargetAchievement() {
  const year = new Date().getFullYear();
  const targets = useTargets({ year, status: "active" });
  const [targetId, setTargetId] = useState<string>();
  const [metric, setMetric] = useState<"amount" | "count">("amount");
  const [open, setOpen] = useState<string | null>(null);

  const activeId = targetId ?? targets.data?.[0]?.id;
  const perf = useTargetPerformance(activeId, metric);
  const d = perf.data;
  const unit = metric === "amount" ? " ETB" : "";

  const districts = [...(d?.districts ?? [])].sort(
    (a, b) => Number(b.achievement_percent ?? 0) - Number(a.achievement_percent ?? 0),
  );

  return (
    <section
      aria-label="Target achievement"
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/15 dark:bg-[#161a5c]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Target size={16} /> Target achievement {d ? `· ${d.year}` : ""}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {(targets.data?.length ?? 0) > 1 && (
            <select
              value={activeId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-transparent px-2 text-xs dark:border-white/15"
            >
              {targets.data!.map((t) => (
                <option key={t.id} value={t.id} className="text-slate-900">
                  {t.name || t.service_types.map((s) => s.name).join(" + ")}
                </option>
              ))}
            </select>
          )}
          <div role="group" aria-label="Measure" className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/15">
            {(["amount"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition",
                  metric === m ? "bg-[#2c317b] text-white" : "text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10",
                )}
              >
                {m === "amount" ? "Amount" : "Count"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {targets.isSuccess && !activeId ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-white/60">No active target for {year}.</p>
      ) : perf.isError ? (
        <p className="py-8 text-center text-sm text-red-600 dark:text-red-300">{errorMessage(perf.error)}</p>
      ) : !d ? (
        <div aria-hidden className="mt-4 h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-white/15">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500 dark:text-white/60">{d.name || "Annual target"}</p>
                <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{pct(d.achievement_percent)}</p>
              </div>
              <p className="text-xs tabular-nums text-slate-600 dark:text-white/70">
                {num(d.actual_value)} of {num(d.target_value)}
                {unit}
              </p>
            </div>
            <div className="mt-3">
              <Bar value={Number(d.achievement_percent ?? 0)} />
            </div>
            {Number(d.actual_outside_districts) > 0 && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                {num(d.actual_outside_districts)}
                {unit} was recorded in districts that have no share of this target.
              </p>
            )}
          </div>

          <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
            {districts.length === 0 && (
              <li className="py-6 text-center text-xs text-slate-500 dark:text-white/60">This target is not split across districts yet.</li>
            )}
            {districts.map((dist) => {
              const expanded = open === dist.district_id;
              const p = Number(dist.achievement_percent ?? 0);
              return (
                <li key={dist.district_id} className="py-2.5">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : dist.district_id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                        <ChevronDown size={14} className={cn("transition", expanded && "rotate-180")} />
                        {dist.district_name}
                      </span>
                      <span className="text-xs tabular-nums text-slate-600 dark:text-white/70">
                        {num(dist.actual_value)} / {num(dist.target_value)} · <b>{pct(dist.achievement_percent)}</b>
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Bar value={p} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-white/15">
                      <table className="w-full text-xs">
                        <thead className="text-left text-slate-500 dark:text-white/60">
                          <tr>
                            <th className="px-3 py-1.5 font-medium">Month</th>
                            <th className="px-3 py-1.5 text-right font-medium">Target</th>
                            <th className="px-3 py-1.5 text-right font-medium">Actual</th>
                            <th className="px-3 py-1.5 text-right font-medium">Achieved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dist.months.map((m) => (
                            <tr key={m.month} className="border-t border-slate-100 dark:border-white/10">
                              <td className="px-3 py-1.5">{MONTHS[m.month - 1]}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{num(m.target_value)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{num(m.actual_value)}</td>
                              <td
                                className={cn(
                                  "px-3 py-1.5 text-right tabular-nums",
                                  m.achievement_percent != null && Number(m.achievement_percent) >= 100 && "font-semibold text-emerald-600 dark:text-emerald-300",
                                )}
                              >
                                {pct(m.achievement_percent)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}