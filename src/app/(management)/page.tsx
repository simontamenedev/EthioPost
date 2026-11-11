"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BriefcaseBusiness, Building2, MapPinned, Trophy, UserCheck, UserPlus, WalletCards,
} from "lucide-react";
import { stagger, rise } from "../../components/dashboard-motion";
import { StatCard } from "../../components/stat-card";
import { RankedBars } from "../../components/ranked-bars";
import { DistrictDonut } from "../../components/district-donut";
import { HighlightsCard } from "../../components/highlights-card";
import { useDashboardOverview, useDashboardStats } from "../features/dashboard/hooks/hooks";
import { DateRangeFilter } from "../features/analytics/components/date-range-filter";
import { DateRange, presetRange } from "../features/analytics/lib/date-range";
import type { OverallRow, TopRow } from "../../lib/api/analytics-types";

const avg = (total: number, n: number) => (n > 0 ? total / n : 0);
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const shortName = (s: string) => s.replace("Ethiopia Postal Service Enterprise ", "");

// Same shape the old Excel summaries had: { name, commission, records }.
const toEntries = (rows: (OverallRow | TopRow)[] | undefined, short = false) =>
  (rows ?? []).map((r) => ({
    name: short ? shortName(r.key) : r.label,
    commission: r.ethiopost,
    records: r.records ?? 0,
  }));

export default function HomePage() {
  const [range, setRange] = useState<DateRange>(presetRange("last30"));
  const overview = useDashboardOverview(range, 10);
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const d = overview.data;

  const total = d?.totals.ethiopost_commission ?? 0;
  const counts = {
    agents: d?.active.agents ?? 0,
    branches: d?.active.branches ?? 0,
    districts: d?.active.districts ?? 0,
  };

  const { agents, branches, districts, providers } = useMemo(
    () => ({
      agents: toEntries(d?.overall?.agents, true),
      branches: toEntries(d?.overall?.branches, true),
      districts: toEntries(d?.overall?.districts),
      providers: (d?.by_fsp ?? []).map((r) => ({
        name: r.fsp_name,
        commission: r.ethiopost_commission,
        records: r.records ?? 0,
      })),
    }),
    [d],
  );

  const forFsp = (rows: TopRow[] | undefined, fspId: string) =>
    toEntries((rows ?? []).filter((r) => r.fsp_id === fspId), true);

  const topFsp = d?.by_fsp[0];

  return (
    <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-5 font-mono text-xs font-medium text-slate-500 dark:text-white/60"
      >
        /
      </motion.p>

      <div className="mb-5">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {overview.isError && (
        <p className="mb-5 rounded-2xl border border-dashed border-[#2c317b]/30 bg-white px-6 py-6 text-center text-sm text-slate-600 dark:border-white/20 dark:bg-[#161a5c] dark:text-white/75">
          Could not load the dashboard: {overview.error?.message}
        </p>
      )}

      {!d ? (
        <div aria-hidden className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[164px] rounded-2xl bg-slate-200/70 dark:bg-white/10" />
          ))}
        </div>
      ) : d.by_fsp.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#2c317b]/30 bg-white px-6 py-12 text-center text-sm text-slate-600 dark:border-white/20 dark:bg-[#161a5c] dark:text-white/75">
          No commission data for this period.
        </p>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
          <section aria-label="Commission overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              hero
              label="Ethio Post commission"
              value={total}
              decimals={2}
              unit="ETB"
              note={`Total commission ${fmt(d.totals.fsp_commission)} · Agents ${fmt(d.totals.agent_commission)} ETB`}
              icon={WalletCards}
            />
            <StatCard
              label="Agents"
              value={counts.agents}
              icon={BriefcaseBusiness}
            />
            <StatCard
              label="Branches"
              value={counts.branches}              
              icon={Building2}
            />
            <StatCard
              label="Districts"
              value={counts.districts}
              
              icon={MapPinned}
            />
            <StatCard
              label="Customer registrations"
              value={d.totals.registrations}
              note="new customers in period"
              icon={UserPlus}
            />
            <StatCard
              label="Customer upgrades"
              value={d.totals.upgrades}
              note="customers upgraded in period"
              icon={UserCheck}
            />
            <StatCard
              label="Transaction value"
              value={d.totals.amount}
              decimals={2}
              unit="ETB"
              note={`${fmt(d.totals.txns)} transactions`}
              icon={WalletCards}
            />
            <StatCard
              label="Top provider"
              value={topFsp?.ethiopost_commission ?? 0}
              decimals={2}
              unit="ETB"
              note={topFsp?.fsp_name ?? "—"}
              icon={Trophy}
            />
          </section>

          <div className="grid gap-5 xl:grid-cols-3">
            <motion.div variants={rise} className="xl:col-span-2">
              <RankedBars title="Top agents" noun="agent" icon={BriefcaseBusiness} entries={agents} total={total} />
            </motion.div>
            <motion.div variants={rise}>
              <DistrictDonut entries={districts} total={total} />
            </motion.div>
          </div>



          {/* Financial service providers */}
          <div className="grid gap-5 xl:grid-cols-3">
            <motion.div variants={rise} className="xl:col-span-2">
              <RankedBars title="Top providers" noun="provider" icon={Trophy} entries={providers} total={total} />
            </motion.div>
          </div>

          {d.by_fsp.map((fsp) => (
            <div key={fsp.fsp_id} className="grid gap-5 xl:grid-cols-2">
              <motion.div variants={rise}>
                <RankedBars
                  title={`${fsp.fsp_name} · top agents`}
                  noun="agent"
                  icon={BriefcaseBusiness}
                  entries={forFsp(d.top_agents, fsp.fsp_id)}
                  total={fsp.ethiopost_commission}
                />
              </motion.div>
              <motion.div variants={rise}>
                <RankedBars
                  title={`${fsp.fsp_name} · top districts`}
                  noun="district"
                  icon={MapPinned}
                  entries={forFsp(d.top_districts, fsp.fsp_id)}
                  total={fsp.ethiopost_commission}
                />
              </motion.div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}