"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../../../components/ui/badge";
import { errorMessage } from "../../../../lib/api/client";
import { cn } from "../../../../lib/utils";
import type { AnalyticsFilters, DatasetKey } from "../../../../lib/api/analytics-types";
import { DateRangeFilter } from "./date-range-filter";
import { card, pageDescription, pageShell, pageTitle, secondaryButton } from "../styles/styles";
import { DateRange, presetRange } from "../lib/date-range";
import { exportBreakdown, useBreakdown, useOverview, useTimeseries } from "../hooks/use-analytics";
import { formatBirr, formatCompact, formatInt } from "../../transactions/const/format";

function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span className={cn("text-xs font-semibold", up ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300")}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% <span className="font-normal text-slate-500 dark:text-white/60">vs previous period</span>
    </span>
  );
}

function Kpi({ label, value, pct }: { label: string; value: string; pct?: number | null }) {
  return (
    <div className={card}>
      <p className="text-sm text-slate-600 dark:text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <div className="mt-1 min-h-4"><Delta pct={pct} /></div>
    </div>
  );
}

/** Horizontal bar list: no chart library needed. */
function RankedList({
  title, rows, metric, format, onExport,
}: {
  title: string;
  rows: { key: string; label: string; value: number }[] | undefined;
  metric: string;
  format: (n: number) => string;
  onExport?: () => void;
}) {
  const max = Math.max(1, ...(rows?.map((r) => r.value) ?? [0]));
  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-white/60">{metric}</p>
        </div>
        {onExport && (
          <button type="button" onClick={onExport} aria-label={`Export ${title}`} className={cn(secondaryButton, "h-9 px-3")}>
            <Download size={14} /> CSV
          </button>
        )}
      </div>
      {!rows ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-white/60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-white/60">No data for this period</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-slate-800 dark:text-white/90">{r.label}</span>
                <span className="shrink-0 font-semibold text-slate-900 dark:text-white">{format(r.value)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-2 rounded-full bg-[#2c317b] dark:bg-sky-400" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const shortName = (s: string) => s.replace("Ethiopia Postal Service Enterprise ", "");

export function OverviewView() {
  const [range, setRange] = useState<DateRange>(presetRange("last30"));
  const filters: AnalyticsFilters = range;

  const overview = useOverview(filters);
  const daily = useTimeseries("transactions", filters, { interval: "day" });
  const byAgent = useBreakdown("transactions", filters, { dimension: "agent", limit: 8 });
  const byService = useBreakdown("transactions", filters, { dimension: "service_type" });
  const byRegion = useBreakdown("registrations", filters, { dimension: "region", limit: 8 });

  const tx = overview.data?.transactions;
  const reg = overview.data?.registrations;
  const upg = overview.data?.upgrades;
  const dailyMax = Math.max(1, ...(daily.data?.map((d) => Number(d.amount)) ?? [0]));

  const exportCsv = (d: DatasetKey, dimension: string) => () =>
    exportBreakdown(d, filters, dimension).catch((e) => toast.error(errorMessage(e)));

  return (
    <div className={pageShell}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className={pageTitle}>Overview</h1>
          <p className={pageDescription}>Agent performance for the selected period.</p>
        </div>
        {overview.isError && <Badge tone="blue">Could not load data</Badge>}
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Transactions" value={tx ? formatInt(tx.current.txn_count) : "—"} pct={tx?.change_pct?.txn_count} />
        <Kpi label="Value (ETB)" value={tx ? formatCompact(tx.current.amount) : "—"} pct={tx?.change_pct?.amount} />
        <Kpi label="Active agents" value={tx ? formatInt(tx.current.active_agents) : "—"} pct={tx?.change_pct?.active_agents} />
        <Kpi label="Registrations" value={reg ? formatInt(reg.current.registrations) : "—"} pct={reg?.change_pct?.registrations} />
        <Kpi label="Upgrades" value={upg ? formatInt(upg.current.upgrades) : "—"} pct={upg?.change_pct?.upgrades} />
      </div>

      <div className={card}>
        <h2 className="font-semibold text-slate-900 dark:text-white">Daily transaction value</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-white/60">ETB per day</p>
        {daily.data && daily.data.length > 0 ? (
          <div className="flex h-40 items-end gap-1" role="img" aria-label="Daily transaction value">
            {daily.data.map((d) => (
              <div
                key={d.period}
                title={`${d.period}: ${formatBirr(Number(d.amount))} ETB`}
                className="min-w-1 flex-1 rounded-t bg-[#2c317b] dark:bg-sky-400"
                style={{ height: `${Math.max(2, (Number(d.amount) / dailyMax) * 100)}%` }}
              />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-white/60">{daily.isLoading ? "Loading…" : "No data for this period"}</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankedList
          title="Top agents"
          metric="Transaction value (ETB)"
          rows={byAgent.data?.map((r) => ({ key: r.key, label: shortName(String(r.label)), value: Number(r.amount) }))}
          format={formatCompact}
          onExport={exportCsv("transactions", "agent")}
        />
        <RankedList
          title="By service"
          metric="Transaction value (ETB)"
          rows={byService.data?.map((r) => ({ key: r.key, label: String(r.label), value: Number(r.amount) }))}
          format={formatCompact}
          onExport={exportCsv("transactions", "service_type")}
        />
        <RankedList
          title="Registrations by region"
          metric="New customers"
          rows={byRegion.data?.map((r) => ({ key: r.key, label: String(r.label), value: Number(r.registrations) }))}
          format={formatInt}
          onExport={exportCsv("registrations", "region")}
        />
      </div>
    </div>
  );
}
