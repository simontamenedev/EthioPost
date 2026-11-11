"use client";

import { cn } from "../../../../lib/utils";
import type { AnalyticsFilters, DatasetKey } from "../../../../lib/api/analytics-types";
import { formatBirr, formatInt } from "../../transactions/const/format";
import { useSummary } from "../hooks/use-analytics";

type Kpi = { key: string; label: string; money?: boolean; tone?: string };

// fsp_commission is the total the FSP pays to Ethio Post (the rule amount).
// It is then split into the agent's share and Ethio Post's share.
const COMMISSION: Kpi[] = [
  { key: "fsp_commission", label: "Total commission", money: true },
  { key: "agent_commission", label: "Agents earn", money: true, tone: "text-emerald-600 dark:text-emerald-400" },
  { key: "ethiopost_commission", label: "Ethio Post earns", money: true, tone: "text-sky-600 dark:text-sky-400" },
];

const KPIS: Record<DatasetKey, Kpi[]> = {
  transactions: [
    { key: "txn_count", label: "Transactions" },
    { key: "amount", label: "Total amount", money: true },
    ...COMMISSION,
    { key: "active_agents", label: "Active agents" },
  ],
  registrations: [
    { key: "registrations", label: "Registrations" }, ...COMMISSION, { key: "active_agents", label: "Active agents" },
  ],
  upgrades: [
    { key: "upgrades", label: "Upgrades" }, ...COMMISSION, { key: "active_agents", label: "Active agents" },
  ],
};

export function CommissionKpis({ dataset, filters }: { dataset: DatasetKey; filters: AnalyticsFilters }) {
  const { data, isLoading } = useSummary(dataset, filters);
  const kpis = KPIS[dataset];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => {
        const value = data?.current[k.key];
        const change = data?.change_pct?.[k.key];
        return (
          <div key={k.key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-medium text-slate-500 dark:text-white/60">{k.label}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white", k.tone)}>
              {isLoading || value == null ? "…" : k.money ? formatBirr(value) : formatInt(value)}
            </p>
            {change != null && (
              <p className={cn("mt-0.5 text-xs", change >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs previous period
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}