"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { BriefcaseBusiness, Building2, MapPinned, WalletCards } from "lucide-react";
import { useCommissionData } from "../../components/commission-data";
import DashboardShell from "../../components/dashboard-shell";
import { stagger, rise } from "../../components/dashboard-motion";
import { StatCard } from "../../components/stat-card";
import { RankedBars } from "../../components/ranked-bars";
import { DistrictDonut } from "../../components/district-donut";
import { summarizeCommissions } from "../../lib/commission-excel";
import { HighlightsCard } from "../../components/highlights-card";

const avg = (total: number, n: number) => (n > 0 ? total / n : 0);
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function HomePage() {
  const { records, isReady } = useCommissionData();

  const { total, agents, branches, districts } = useMemo(() => {
    const byCommission = <T extends { commission: number }>(list: T[]) => [...list].sort((a, b) => b.commission - a.commission);
    return {
      total: records.reduce((sum, r) => sum + r.commission, 0),
      agents: byCommission(summarizeCommissions(records, "Agent")),
      branches: byCommission(summarizeCommissions(records, "Branch")),
      districts: byCommission(summarizeCommissions(records, "District")),
    };
  }, [records]);

  return (
      <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-5 font-mono text-xs font-medium text-slate-500 dark:text-white/60">
          /
        </motion.p>

        {!isReady ? (
          <div aria-hidden className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[164px] rounded-2xl bg-slate-200/70 dark:bg-white/10" />)}
          </div>
        ) : records.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#2c317b]/30 bg-white px-6 py-12 text-center text-sm text-slate-600 dark:border-white/20 dark:bg-[#161a5c] dark:text-white/75">
            No commission data to show yet.
          </p>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
            <section aria-label="Commission overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard hero label="Total commission" value={total} decimals={2} unit="ETB" note={`From ${records.length.toLocaleString()} records`} icon={WalletCards} />
              <StatCard label="Agents" value={agents.length} note={`Avg ${fmt(avg(total, agents.length))} ETB each`} icon={BriefcaseBusiness} />
              <StatCard label="Branches" value={branches.length} note={`Avg ${fmt(avg(total, branches.length))} ETB per branch`} icon={Building2} />
              <StatCard label="Districts" value={districts.length} note={`Avg ${fmt(avg(total, districts.length))} ETB per district`} icon={MapPinned} />
            </section>

            <div className="grid gap-5 xl:grid-cols-3">
              <motion.div variants={rise} className="xl:col-span-2"><RankedBars title="Top agents" noun="agent" icon={BriefcaseBusiness} entries={agents} total={total} /></motion.div>
              <motion.div variants={rise}><DistrictDonut entries={districts} total={total} /></motion.div>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <motion.div variants={rise} className="xl:col-span-2"><RankedBars title="Top branches" noun="branch" icon={Building2} entries={branches} total={total} /></motion.div>
              <motion.div variants={rise}>
                <HighlightsCard
                  total={total}
                  leaders={[
                    { label: "Top agent", name: agents[0]?.name, commission: agents[0]?.commission ?? 0, icon: BriefcaseBusiness },
                    { label: "Top branch", name: branches[0]?.name, commission: branches[0]?.commission ?? 0, icon: Building2 },
                    { label: "Top district", name: districts[0]?.name, commission: districts[0]?.commission ?? 0, icon: MapPinned },
                  ]}
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
  );
}
