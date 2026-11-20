"use client";

import { Building2, CalendarRange, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Collapse } from "../../../../components/ui/collapse";
import type { ServiceTypeTarget } from "../../../../lib/api/types";
import { cn } from "../../../../lib/utils";
import { usePeriods, useTarget } from "../hooks";
import { TargetPeriods } from "./target-periods";

const num = (v: string | number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (v: string | number) => `${Number(v).toFixed(1)}%`;

const line = "bg-slate-200 dark:bg-white/15";
const branch =
  "relative pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-px last:before:h-5 " +
  "after:absolute after:left-0 after:top-5 after:h-px after:w-5 " +
  `before:${line.split(" ")[0]} after:${line.split(" ")[0]} dark:before:bg-white/15 dark:after:bg-white/15`;

function Node({
  icon,
  title,
  count,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-3 py-2 text-left">
        <ChevronRight size={16} className={cn("shrink-0 text-slate-500 transition-transform motion-reduce:transition-none dark:text-white/60", open && "rotate-90")} />
        <span className="flex size-9 shrink-0 items-center justify-center bg-[#2c317b]/10 text-[#2c317b] dark:bg-white/10 dark:text-white">{icon}</span>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="bg-slate-100 px-1.5 text-xs font-semibold tabular-nums text-slate-600 dark:bg-white/10 dark:text-white/70">{count}</span>
        {summary && <span className="ml-auto text-xs text-slate-500 dark:text-white/60">{summary}</span>}
      </button>
      <Collapse open={open}>{children}</Collapse>
    </div>
  );
}

/** Content of the collapsible row under a target: districts and periods as a tree. */
export function TargetBreakdown({ target }: { target: ServiceTypeTarget }) {
  const detail = useTarget(target.id);
  const periods = usePeriods(target.id);
  const [open, setOpen] = useState({ districts: true, periods: true });

  const districts = detail.data?.district_targets ?? [];

  return (
    <div className="space-y-1">
      <Node
        icon={<Building2 size={17} />}
        title="Districts"
        count={districts.length}
        summary={`${Number(target.allocated_percent).toFixed(1)}% allocated`}
        open={open.districts}
        onToggle={() => setOpen((o) => ({ ...o, districts: !o.districts }))}
      >
        {detail.isLoading ? (
          <div className="mb-2 ml-[2.875rem] h-12 animate-pulse bg-slate-200 dark:bg-white/10" aria-hidden />
        ) : districts.length ? (
          <ul className="mb-2 ml-[2.875rem]">
            {districts.map((d) => (
              <li key={d.id} className={branch}>
                <div className="flex items-center gap-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/80">
                    <Building2 size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{d.district.name}</p>
                    <p className="text-xs text-slate-500 dark:text-white/60">
                      {Number(d.phased_percent) > 0 ? `${pct(d.phased_percent)} phased by month` : "Not phased by month"}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-slate-700 dark:text-white/80">{num(d.target_value)}</span>
                  <span className="w-14 text-right text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{pct(d.target_percent)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 ml-[2.875rem] pl-6 text-sm text-slate-600 dark:text-white/70">Not split across districts yet.</p>
        )}
      </Node>

      <Node
        icon={<CalendarRange size={17} />}
        title="Periods"
        count={periods.data?.length ?? 0}
        open={open.periods}
        onToggle={() => setOpen((o) => ({ ...o, periods: !o.periods }))}
      >
        <div className="mb-2 ml-[2.875rem] border-l border-slate-200 pl-6 dark:border-white/15">
          <TargetPeriods target={target} />
        </div>
      </Node>
    </div>
  );
}