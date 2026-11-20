"use client";

import { useMemo, useState } from "react";
import { DonutChart, Legend, toneAt, type Slice, type Tone } from "./donut-chart";
import { card, inputBase } from "../../../../components/ui/styles";
import type { PerformanceMetric, ServiceTypeTarget, TargetPerformance } from "../../../../lib/api/types";
import { cn, formatDate } from "../../../../lib/utils";
import { useTargetPerformance, useTargets } from "../hooks";
import { MetricToggle } from "./metric-toggle";

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (v: string | number | null | undefined) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const label = (t: ServiceTypeTarget) => t.name || t.service_types.map((s) => s.name).join(" + ");

const Skeleton = ({ h = "h-40" }: { h?: string }) => (
  <div className={cn("w-full animate-pulse bg-slate-200 dark:bg-white/10", h)} aria-hidden />
);

export function PerformanceOverview({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const list = useTargets({ skip: 0, limit: 200, status: "active", date_from: dateFrom, date_to: dateTo });
  const [selectedId, setSelectedId] = useState("");
  const [metric, setMetric] = useState<PerformanceMetric>("amount");

  const targets = useMemo(() => list.data ?? [], [list.data]);
  const today = new Date().toISOString().slice(0, 10);
  const target =
    targets.find((t) => t.id === selectedId) ??
    targets.find((t) => t.start_date <= today && today <= t.end_date) ??
    targets[0];
  const perf = useTargetPerformance(target?.id, metric);

  if (list.isLoading) return <Skeleton h="h-56" />;
  if (!target) return null;

  return (
    <section aria-label="Performance overview" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#2c317b] dark:text-white">
            Performance so far
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-white/70">
            {formatDate(target.start_date)} – {formatDate(target.end_date)} · actual against target, by district
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Target to assess"
            value={target.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className={cn(inputBase, "!h-9 !w-auto max-w-[18rem] !py-1 !text-xs")}
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {label(t)} ({formatDate(t.start_date)} – {formatDate(t.end_date)})
              </option>
            ))}
          </select>
          <MetricToggle value={metric} onChange={setMetric} />
        </div>
      </div>

      {perf.isLoading && <Skeleton h="h-56" />}
      {perf.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-300">
          {perf.error?.message ?? "Couldn’t load performance."}
        </p>
      )}
      {perf.data && <Body p={perf.data} />}
    </section>
  );
}

function Body({ p }: { p: TargetPerformance }) {
  const target = n(p.target_value);
  const actual = n(p.actual_value);
  const outside = n(p.actual_outside_districts);
  const districts = [...p.districts].sort((a, b) => n(b.achievement_percent) - n(a.achievement_percent));

  // Pie 1: achieved vs remaining
  const achieved: Slice[] = [
    { label: "Achieved", value: Math.min(actual, target), tone: "blue" },
    { label: "Remaining", value: Math.max(target - actual, 0), tone: "muted" },
  ];

  // Pie 2: actual by district (top 5, the rest grouped)
  const byActual = p.districts.filter((d) => n(d.actual_value) > 0).sort((a, b) => n(b.actual_value) - n(a.actual_value));
  const others = byActual.slice(5).reduce((s, d) => s + n(d.actual_value), 0);
  const byDistrict: Slice[] = [
    ...byActual.slice(0, 5).map((d, i) => ({ label: d.district_name, value: n(d.actual_value), tone: toneAt(i) })),
    ...(others > 0 ? [{ label: "Other districts", value: others, tone: "gold3" as Tone }] : []),
    ...(outside > 0 ? [{ label: "Outside districts", value: outside, tone: "muted" as Tone }] : []),
  ];

  const kpis = [
    { label: "Target", value: fmt(target), sub: p.metric === "amount" ? "Amount" : "Transactions" },
    {
      label: "Allocated to districts",
      value: fmt(n(p.allocated_value)),
      sub: target ? `${((n(p.allocated_value) / target) * 100).toFixed(1)}% of target` : "—",
    },
    { label: "Actual so far", value: fmt(actual), sub: "Districts with a share" },
    { label: "Achievement", value: pct(p.achievement_percent), sub: `${fmt(Math.max(target - actual, 0))} to go` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn(card, "px-4 py-3")}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60">{k.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{k.value}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(card, "p-4")}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Achieved vs target</h3>
          <div className="flex items-center gap-4">
            <DonutChart
              label="Achieved versus target"
              slices={achieved}
              center={
                <>
                  <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{pct(p.achievement_percent)}</span>
                  <span className="text-[10px] text-slate-500 dark:text-white/60">achieved</span>
                </>
              }
            />
            <Legend items={achieved.map((s) => ({ label: s.label, tone: s.tone, value: fmt(s.value) }))} />
          </div>
        </div>

        <div className={cn(card, "p-4")}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Actual by district</h3>
          {byDistrict.length ? (
            <div className="flex items-center gap-4">
              <DonutChart
                label="Actual by district"
                slices={byDistrict}
                center={
                  <>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{fmt(actual + outside)}</span>
                    <span className="text-[10px] text-slate-500 dark:text-white/60">actual</span>
                  </>
                }
              />
              <Legend items={byDistrict.map((s) => ({ label: s.label, tone: s.tone, value: fmt(s.value) }))} />
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-white/60">No actuals recorded yet.</p>
          )}
        </div>

        <div className={cn(card, "p-4")}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">District progress</h3>
          {districts.length ? (
            <ul className="max-h-48 space-y-3 overflow-y-auto pr-1">
              {districts.map((d) => {
                const ach = d.achievement_percent == null ? null : n(d.achievement_percent);
                return (
                  <li key={d.district_id}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">{d.district_name}</span>
                      <span className="shrink-0 tabular-nums text-slate-600 dark:text-white/70">{pct(ach)}</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-slate-100 dark:bg-white/10">
                      <div
                        className={cn("h-full transition-[width]", ach != null && ach >= 100 ? "bg-[#f3ad1c]" : "bg-[#2c317b] dark:bg-white")}
                        style={{ width: `${Math.min(100, ach ?? 0)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] tabular-nums text-slate-500 dark:text-white/60">
                      {fmt(n(d.actual_value))} of {fmt(n(d.target_value))}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-white/60">No districts have a share yet.</p>
          )}
        </div>
      </div>

      {outside > 0 && (
        <p className="text-xs text-slate-500 dark:text-white/60">
          {fmt(outside)} was recorded in districts that have no share in this target.
        </p>
      )}
    </div>
  );
}