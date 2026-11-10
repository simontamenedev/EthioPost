"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, MapPinned, Trophy, UserCheck, UserPlus, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../../../lib/utils";
import type { DashboardTotals, TopRow } from "../../../../lib/api/analytics-types";
import { DateRangeFilter } from "../../analytics/components/date-range-filter";
import { DateRange, presetRange } from "../../analytics/lib/date-range";
import { card, pageDescription, pageShell, pageTitle } from "../../analytics/styles/styles";
import { formatBirr, formatCompact, formatInt } from "../../transactions/const/format";
import { useDashboardOverview, useDashboardStats } from "../hooks/hooks";
import { DonutChart } from "./donut-chart";

const shortName = (s: string) => s.replace("Ethiopia Postal Service Enterprise ", "");

function Delta({ pct, hero }: { pct: number | null | undefined; hero?: boolean }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "text-xs font-semibold",
        hero
          ? up ? "text-emerald-300" : "text-red-300"
          : up ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300",
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%{" "}
      <span className={cn("font-normal", hero ? "text-white/70" : "text-slate-500 dark:text-white/60")}>
        vs previous period
      </span>
    </span>
  );
}

function Kpi({
  label, value, note, pct, icon: Icon, hero,
}: {
  label: string;
  value: string;
  note?: string;
  pct?: number | null;
  icon: LucideIcon;
  hero?: boolean;
}) {
  return (
    <div className={cn(card, hero && "bg-[#2c317b] text-white dark:bg-[#2c317b]")}>
      <div className="flex items-center justify-between">
        <p className={cn("text-sm", hero ? "text-white/80" : "text-slate-600 dark:text-white/70")}>{label}</p>
        <Icon size={18} className={hero ? "text-white/80" : "text-slate-400 dark:text-white/50"} />
      </div>
      <p className={cn("mt-1 text-2xl font-bold", !hero && "text-slate-900 dark:text-white")}>{value}</p>
      {note && (
        <p className={cn("mt-0.5 text-xs", hero ? "text-white/70" : "text-slate-500 dark:text-white/60")}>{note}</p>
      )}
      {pct !== undefined && (
        <div className="mt-1 min-h-4">
          <Delta pct={pct} hero={hero} />
        </div>
      )}
    </div>
  );
}

function Bars({
  rows, format = formatCompact,
}: {
  rows: { key: string; label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500 dark:text-white/60">No data for this period</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-800 dark:text-white/90">{r.label}</span>
            <span className="shrink-0 font-semibold text-slate-900 dark:text-white">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-white/10">
            <div
              className="h-2 rounded-full bg-[#2c317b] dark:bg-sky-400"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardView() {
  const [range, setRange] = useState<DateRange>(presetRange("last30"));
  const overview = useDashboardOverview(range);
  const stats = useDashboardStats();
  const d = overview.data;

  const byFsp = (rows: TopRow[] | undefined, fspId: string) => (rows ?? []).filter((r) => r.fsp_id === fspId);
  const topFsp = d?.by_fsp[0];
  const dailyMax = useMemo(() => Math.max(1, ...(d?.daily.map((x) => x.ethiopost) ?? [0])), [d]);
  const pct = (k: keyof DashboardTotals) => (d ? d.change_pct?.[k] ?? null : undefined);

  return (
    <div className={pageShell}>
      <div className="min-w-0">
        <h1 className={pageTitle}>Ethio Post dashboard</h1>
        <p className={pageDescription}>Commission, agents and customer growth by financial service provider.</p>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      {overview.isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
          Could not load the dashboard: {overview.error?.message}
        </p>
      )}

      {/* KPI boxes */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          hero
          icon={WalletCards}
          label="Ethio Post commission (ETB)"
          value={d ? formatBirr(d.totals.ethiopost_commission) : "—"}
          note={
            d
              ? `Agents earned ${formatBirr(d.totals.agent_commission)} · FSPs paid ${formatBirr(d.totals.fsp_commission)}`
              : undefined
          }
          pct={pct("ethiopost_commission")}
        />
        <Kpi
          icon={BriefcaseBusiness}
          label="Agents"
          value={d ? formatInt(d.active.agents) : "—"}
          note={`active in period · ${formatInt(stats.data?.agents.total ?? 0)} registered`}
        />
        <Kpi
          icon={Building2}
          label="Branches"
          value={d ? formatInt(d.active.branches) : "—"}
          note={`active in period · ${formatInt(stats.data?.branches.total ?? 0)} registered`}
        />
        <Kpi
          icon={MapPinned}
          label="Districts"
          value={d ? formatInt(d.active.districts) : "—"}
          note={`active in period · ${formatInt(stats.data?.districts.total ?? 0)} registered`}
        />
        <Kpi
          icon={UserPlus}
          label="Customer registrations"
          value={d ? formatInt(d.totals.registrations) : "—"}
          pct={pct("registrations")}
        />
        <Kpi
          icon={UserCheck}
          label="Customer upgrades"
          value={d ? formatInt(d.totals.upgrades) : "—"}
          pct={pct("upgrades")}
        />
        <Kpi
          icon={WalletCards}
          label="Transaction value (ETB)"
          value={d ? formatCompact(d.totals.amount) : "—"}
          pct={pct("amount")}
        />
        <Kpi
          icon={Trophy}
          label="Top provider"
          value={topFsp?.fsp_name ?? "—"}
          note={topFsp ? `${formatBirr(topFsp.ethiopost_commission)} ETB to Ethio Post` : undefined}
        />
      </div>

      {/* Commission by provider */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className={cn(card, "xl:col-span-2")}>
          <h2 className="font-semibold text-slate-900 dark:text-white">Commission by provider</h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-white/60">ETB, for the selected period</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-white/60">
                  <th className="pb-2 font-medium">Provider</th>
                  <th className="pb-2 text-right font-medium">FSP pays</th>
                  <th className="pb-2 text-right font-medium">Agents</th>
                  <th className="pb-2 text-right font-medium">Ethio Post</th>
                  <th className="pb-2 text-right font-medium">Registrations</th>
                  <th className="pb-2 text-right font-medium">Upgrades</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-slate-900 dark:text-white">
                {d?.by_fsp.map((r, i) => (
                  <tr key={r.fsp_id} className="border-t border-slate-100 dark:border-white/10">
                    <td className="py-2 font-semibold">
                      {i === 0 && <Trophy size={14} className="mr-1 inline text-amber-500" />}
                      {r.fsp_name}
                    </td>
                    <td className="py-2 text-right">{formatBirr(r.fsp_commission)}</td>
                    <td className="py-2 text-right">{formatBirr(r.agent_commission)}</td>
                    <td className="py-2 text-right font-semibold">{formatBirr(r.ethiopost_commission)}</td>
                    <td className="py-2 text-right">{formatInt(r.registrations)}</td>
                    <td className="py-2 text-right">{formatInt(r.upgrades)}</td>
                  </tr>
                ))}
                {d && d.by_fsp.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 dark:text-white/60">
                      No data for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-slate-900 dark:text-white">Top providers</h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-white/60">Ethio Post commission (ETB)</p>
          <Bars
            rows={(d?.by_fsp ?? []).map((r) => ({ key: r.fsp_id, label: r.fsp_name, value: r.ethiopost_commission }))}
          />
        </div>
      </div>

      {/* Pie charts */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DonutChart
          title="Commission split"
          subtitle="Who keeps the FSP commission"
          centerLabel="Total"
          format={formatCompact}
          slices={
            d
              ? [
                  { key: "ethi", label: "Ethio Post", value: d.totals.ethiopost_commission, color: "#6366f1" },
                  { key: "agent", label: "Agents", value: d.totals.agent_commission, color: "#10b981" },
                ]
              : []
          }
        />
        <DonutChart
          title="Ethio Post commission by provider"
          subtitle="ETB"
          format={formatCompact}
          slices={(d?.by_fsp ?? []).map((r) => ({ key: r.fsp_id, label: r.fsp_name, value: r.ethiopost_commission }))}
        />
        <DonutChart
          title="Registrations by provider"
          subtitle="New customers"
          centerLabel="Customers"
          format={formatInt}
          slices={(d?.by_fsp ?? []).map((r) => ({ key: r.fsp_id, label: r.fsp_name, value: r.registrations }))}
        />
        <DonutChart
          title="Upgrades by provider"
          subtitle="Customers upgraded"
          centerLabel="Upgrades"
          format={formatInt}
          slices={(d?.by_fsp ?? []).map((r) => ({ key: r.fsp_id, label: r.fsp_name, value: r.upgrades }))}
        />
      </div>

      {/* Daily trend */}
      <div className={card}>
        <h2 className="font-semibold text-slate-900 dark:text-white">Daily Ethio Post commission</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-white/60">ETB per day</p>
        {d && d.daily.length > 0 ? (
          <div className="flex h-40 items-end gap-1" role="img" aria-label="Daily Ethio Post commission">
            {d.daily.map((x) => (
              <div
                key={x.period}
                title={`${x.period}: ${formatBirr(x.ethiopost)} ETB`}
                className="min-w-1 flex-1 rounded-t bg-[#2c317b] dark:bg-sky-400"
                style={{ height: `${Math.max(2, (x.ethiopost / dailyMax) * 100)}%` }}
              />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-white/60">
            {overview.isLoading ? "Loading…" : "No data for this period"}
          </p>
        )}
      </div>

      {/* Per provider: top agents + top districts */}
      {d?.by_fsp.map((fsp) => (
        <div key={fsp.fsp_id} className={card}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-slate-900 dark:text-white">{fsp.fsp_name}</h2>
            <p className="text-xs text-slate-500 dark:text-white/60">
              {formatBirr(fsp.ethiopost_commission)} ETB to Ethio Post · {formatInt(fsp.active_agents)} active agents ·{" "}
              {formatInt(fsp.registrations)} registrations · {formatInt(fsp.upgrades)} upgrades
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-white/80">Top agents</h3>
              <Bars
                rows={byFsp(d.top_agents, fsp.fsp_id).map((r) => ({
                  key: r.key, label: shortName(r.label), value: r.ethiopost,
                }))}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-700 dark:text-white/80">Top districts</h3>
              <Bars
                rows={byFsp(d.top_districts, fsp.fsp_id).map((r) => ({
                  key: r.key, label: r.label, value: r.ethiopost,
                }))}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}