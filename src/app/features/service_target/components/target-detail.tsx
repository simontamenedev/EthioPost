"use client";

import { useState } from "react";
import { Building2, ChevronRight, Gauge, Info, Pencil, X } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Collapse } from "../../../../components/ui/collapse";
import { formatDateTime } from "../../../../components/ui/detail-panel";
import { DonutChart, Legend, toneAt, toneBg, type Slice } from "./donut-chart";
import { card } from "../../../../components/ui/styles";
import { errorMessage } from "../../../../lib/api/client";
import type { PerformanceMetric } from "../../../../lib/api/types";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { cn, formatDate } from "../../../../lib/utils";
import { useTarget, useTargetPerformance } from "../hooks";
import { DistrictAllocationEditor } from "./districtAllocationEditor";
import { MetricToggle } from "./metric-toggle";
import { MonthAllocationEditor } from "./monthAllocationEditor";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const n = (v: string | number | null | undefined) => Number(v ?? 0);
const num = (v: string | number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (v: string | number | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);

function Section({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 px-6 py-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center bg-[#2c317b]/10 text-[#2c317b] dark:bg-white/10 dark:text-white">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-white/60">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TargetDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: t, isLoading, error } = useTarget(id);
  const [metric, setMetric] = useState<PerformanceMetric>("amount");
  const perf = useTargetPerformance(id, metric);
  const [editing, setEditing] = useState(false);
  const [phasingFor, setPhasingFor] = useState<string | null>(null); // district_id
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  const toggle = (rowId: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  const title = t?.name || (t ? t.service_types.map((s) => s.name).join(" + ") : "Target");
  const perfByDistrict = new Map((perf.data?.districts ?? []).map((d) => [d.district_id, d]));
  const toneById = new Map((t?.district_targets ?? []).map((d, i) => [d.district_id, toneAt(i)]));

  const allocatedSlices: Slice[] = t
    ? [
        { label: "Allocated", value: n(t.allocated_value), tone: "blue" },
        { label: "Unallocated", value: Math.max(n(t.unallocated_value), 0), tone: "muted" },
      ]
    : [];
  const actual = n(perf.data?.actual_value);
  const target = n(perf.data?.target_value);
  const achievedSlices: Slice[] = [
    { label: "Achieved", value: Math.min(actual, target), tone: "blue" },
    { label: "Remaining", value: Math.max(target - actual, 0), tone: "muted" },
  ];
  const districtActualSlices: Slice[] = (perf.data?.districts ?? [])
    .filter((d) => n(d.actual_value) > 0)
    .map((d) => ({ label: d.district_name, value: n(d.actual_value), tone: toneById.get(d.district_id) ?? "muted" }));

  return (
    <>
      <div className={cn(card, "flex flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]")}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-white/60">Target details</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-1 text-slate-500 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 divide-y divide-slate-200 overflow-y-auto dark:divide-white/10">
          {isLoading && <div className="m-6 h-48 animate-pulse bg-slate-200 dark:bg-white/10" aria-hidden />}
          {error && (
            <p role="alert" className="px-6 py-8 text-sm text-red-600 dark:text-red-300">
              {errorMessage(error)}
            </p>
          )}

          {t && (
            <>
              <div className="space-y-2 px-6 py-5">
                <p className="text-xs text-slate-500 dark:text-white/60">{t.service_types.map((s) => s.name).join(" · ")}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight text-[#2c317b] dark:text-white">{title}</h2>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-sm text-slate-600 dark:text-white/70">
                  {formatDate(t.start_date)} – {formatDate(t.end_date)} · split across districts and months.
                </p>
              </div>

              <dl className="grid grid-cols-3 gap-4 px-6 py-4">
                {[
                  ["Target", num(t.target_value)],
                  ["Allocated", pct(t.allocated_percent)],
                  ["Districts", String(t.district_targets.length)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-500 dark:text-white/60">{k}</dt>
                    <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-white">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* KPI pies */}
              <Section
                icon={<Gauge size={20} />}
                title="Progress"
                description="How much is allocated and how much is achieved."
                action={<MetricToggle value={metric} onChange={setMetric} />}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-white/80">Allocation</p>
                    <DonutChart
                      size={104}
                      thickness={12}
                      label="Allocated versus unallocated"
                      slices={allocatedSlices}
                      center={<span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{Number(t.allocated_percent).toFixed(0)}%</span>}
                    />
                    <Legend items={allocatedSlices.map((s) => ({ label: s.label, tone: s.tone, value: num(s.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-white/80">Achievement</p>
                    {perf.data ? (
                      <>
                        <DonutChart
                          size={104}
                          thickness={12}
                          label="Achieved versus target"
                          slices={achievedSlices}
                          center={
                            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                              {perf.data.achievement_percent == null ? "—" : `${Number(perf.data.achievement_percent).toFixed(0)}%`}
                            </span>
                          }
                        />
                        <Legend items={achievedSlices.map((s) => ({ label: s.label, tone: s.tone, value: num(s.value) }))} />
                      </>
                    ) : (
                      <div className="h-[104px] w-[104px] animate-pulse bg-slate-200 dark:bg-white/10" aria-hidden />
                    )}
                  </div>
                </div>

                {districtActualSlices.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-white/10">
                    <p className="text-xs font-semibold text-slate-700 dark:text-white/80">Actual by district</p>
                    <div className="flex items-center gap-4">
                      <DonutChart size={104} thickness={12} label="Actual by district" slices={districtActualSlices} />
                      <Legend items={districtActualSlices.map((s) => ({ label: s.label, tone: s.tone, value: num(s.value) }))} />
                    </div>
                  </div>
                )}
              </Section>

              {/* District split + months */}
              <Section
                icon={<Building2 size={20} />}
                title="District distribution"
                description="Each district’s share of the target. Open a district to see its months."
              >
                {t.district_targets.length ? (
                  <>
                    <div className="flex h-1.5 w-full gap-px overflow-hidden bg-slate-100 dark:bg-white/10" aria-hidden>
                      {t.district_targets.map((d, i) => (
                        <div key={d.id} className={toneBg(toneAt(i))} style={{ width: `${Math.min(100, n(d.target_percent))}%` }} />
                      ))}
                    </div>

                    <ul className="divide-y divide-slate-100 dark:divide-white/10">
                      {t.district_targets.map((d, i) => {
                        const open = openIds.has(d.id);
                        const p = perfByDistrict.get(d.district_id);
                        const ach = p?.achievement_percent == null ? null : n(p.achievement_percent);
                        return (
                          <li key={d.id}>
                            <div className="flex items-center gap-3 py-3">
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-label={`${open ? "Hide" : "Show"} months for ${d.district.name}`}
                                onClick={() => toggle(d.id)}
                                className="p-0.5 text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
                              >
                                <ChevronRight size={16} className={cn("transition-transform motion-reduce:transition-none", open && "rotate-90")} />
                              </button>
                              <span className={cn("size-2.5 shrink-0", toneBg(toneAt(i)))} aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{d.district.name}</p>
                                <p className="text-xs text-slate-500 dark:text-white/60">
                                  {[
                                    ach != null ? `${ach.toFixed(1)}% achieved` : null,
                                    n(d.phased_percent) > 0 ? `${pct(d.phased_percent)} phased` : "Not phased",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                                {ach != null && (
                                  <div className="mt-1.5 h-1 bg-slate-100 dark:bg-white/10">
                                    <div className="h-full bg-[#2c317b] transition-[width] dark:bg-white" style={{ width: `${Math.min(100, ach)}%` }} />
                                  </div>
                                )}
                              </div>
                              <div className="text-right tabular-nums">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{pct(d.target_percent)}</p>
                                <p className="text-xs text-slate-500 dark:text-white/60">{num(d.target_value)}</p>
                              </div>
                            </div>

                            <Collapse open={open}>
                              <div className="mb-3 ml-[1.4rem] border-l border-slate-200 pl-4 dark:border-white/15">
                                {d.monthly_targets.length ? (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-slate-500 dark:text-white/60">
                                        <th className="py-1 font-medium">Month</th>
                                        <th className="py-1 text-right font-medium">Share</th>
                                        <th className="py-1 text-right font-medium">Target</th>
                                        <th className="py-1 text-right font-medium">Actual</th>
                                      </tr>
                                    </thead>
                                    <tbody className="text-slate-700 dark:text-white/80">
                                      {d.monthly_targets.map((m) => {
                                        const pm = p?.months.find((x) => x.month === m.month);
                                        return (
                                          <tr key={m.month}>
                                            <td className="py-1">{MONTHS[m.month - 1]}</td>
                                            <td className="py-1 text-right tabular-nums">{pct(m.percent)}</td>
                                            <td className="py-1 text-right tabular-nums">{num(m.target_value)}</td>
                                            <td className="py-1 text-right tabular-nums">{pm ? num(pm.actual_value) : "—"}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="py-1 text-xs text-slate-500 dark:text-white/60">No monthly split yet.</p>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => setPhasingFor(d.district_id)}
                                    className="mt-1 text-xs font-semibold text-[#2c317b] hover:underline dark:text-white"
                                  >
                                    {d.monthly_targets.length ? "Edit months" : "Set months"}
                                  </button>
                                )}
                              </div>
                            </Collapse>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-white/10">
                      <span className="text-slate-600 dark:text-white/70">Total allocated</span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                        {pct(t.allocated_percent)} · {num(t.allocated_value)}
                      </span>
                    </div>

                    {n(t.unallocated_value) > 0 && (
                      <div className="flex gap-3 border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-white/70">
                        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
                        <p>
                          <span className="font-semibold text-slate-900 dark:text-white">Unallocated: </span>
                          {num(t.unallocated_value)} ({pct(t.unallocated_percent)}) has no district yet.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-white/70">Not split across districts yet.</p>
                )}
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        {t && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-white/60">Updated {formatDateTime(t.updated_at)}</p>
            <div className="flex gap-2">
              <Button onClick={onClose}>Close</Button>
              {isAdmin && (
                <Button variant="primary" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
                  {t.district_targets.length ? "Edit split" : "Set up split"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {t && isAdmin && <DistrictAllocationEditor target={t} open={editing} onClose={() => setEditing(false)} />}
      {t && isAdmin && phasingFor && (
        <MonthAllocationEditor targetId={t.id} districtId={phasingFor} open onClose={() => setPhasingFor(null)} />
      )}
    </>
  );
}