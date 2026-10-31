"use client";

import Link from "next/link";
import { ArrowRight, Crown, FileSpreadsheet } from "lucide-react";
import { CountUp } from "./count-up";

type Props = { rows: number; topAgent?: string; topDistrict?: string };

/* Post Finance blue → #294896 gradient (brand "Communication in Post Finance Gradient"). */
export function ImportSummaryCard({ rows, topAgent, topDistrict }: Props) {
  return (
    <section className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-[#2c317b] to-[#294896] p-5 text-white shadow-lg shadow-[#2c317b]/25 sm:p-6">
      <div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-[#f3ad1c]"><FileSpreadsheet size={19} /></span>
        <p className="mt-5 text-sm font-medium text-white/80">Rows imported</p>
        <p className="mt-1 text-4xl font-bold tracking-tight"><CountUp value={rows} /></p>
        <p className="mt-2 text-xs leading-5 text-white/75">Summaries are calculated from the commission values in your workbook.</p>

        <dl className="mt-5 space-y-3 border-t border-white/15 pt-4 text-sm">
          {topAgent && (
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-white/75"><Crown size={15} className="text-[#f3ad1c]" /> Top agent</dt>
              <dd className="truncate font-semibold">{topAgent}</dd>
            </div>
          )}
          {topDistrict && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/75">Top district</dt>
              <dd className="truncate font-semibold">{topDistrict}</dd>
            </div>
          )}
        </dl>
      </div>

      <Link href="/reports" className="group mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f3ad1c] px-4 text-sm font-bold text-[#2c317b] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        Open reports <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    </section>
  );
}
