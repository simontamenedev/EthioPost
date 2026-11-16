"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../../components/ui/button";
import { Modal } from "../../../../components/ui/modal";
import { inputBase } from "../../../../components/ui/styles";
import { errorMessage } from "../../../../lib/api/client";
import type { MonthAllocationResponse } from "../../../../lib/api/types";
import { cn } from "../../../../lib/utils";
import { useDistrictMonths, useSetMonthTargets } from "../hooks";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EPS = 0.005;
const parse = (s: string | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const text = (n: number) => (n > 0 ? String(round2(n)) : "");

export function MonthAllocationEditor({
  targetId,
  districtId,
  open,
  onClose,
}: {
  targetId: string;
  districtId: string;
  open: boolean;
  onClose: () => void;
}) {
  const query = useDistrictMonths(targetId, districtId, open);
  const ready = open && query.data && !query.isFetching;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={query.data ? `Monthly phasing · ${query.data.district_name}` : "Monthly phasing"}
      description="Spread this district's target over the months, in percent."
    >
      {ready ? (
        <MonthForm targetId={targetId} data={query.data!} onClose={onClose} />
      ) : (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-white/60">
          {query.isError ? errorMessage(query.error) : "Loading months…"}
        </p>
      )}
    </Modal>
  );
}

function MonthForm({
  targetId,
  data,
  onClose,
}: {
  targetId: string;
  data: MonthAllocationResponse;
  onClose: () => void;
}) {
  const save = useSetMonthTargets();
  const total = Number(data.target_value);

  const [pcts, setPcts] = useState<string[]>(() => data.months.map((m) => text(Number(m.percent))));
  const [applyAll, setApplyAll] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const sum = pcts.reduce((acc, p) => acc + parse(p), 0);
  const remaining = 100 - sum;
  const over = sum > 100 + EPS;

  function splitEvenly() {
    const share = Math.floor((100 / 12) * 100) / 100;
    const first = round2(100 - share * 11); // January absorbs the rounding remainder
    setPcts(Array.from({ length: 12 }, (_, i) => text(i === 0 ? first : share)));
  }

  async function submit() {
    setServerError(null);
    try {
      await save.mutateAsync({
        id: targetId,
        districtId: data.district_id,
        data: {
          mode: "percent",
          apply_to_all_districts: applyAll,
          months: pcts
            .map((p, i) => ({ month: i + 1, percent: parse(p) }))
            .filter((m) => m.percent > 0),
        },
      });
      toast.success("Monthly phasing saved");
      onClose();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="font-normal text-slate-600 dark:text-white/70">
          District target <b className="tabular-nums">{fmt(total)}</b>
        </span>
        <div className="flex gap-3">
          <button type="button" onClick={splitEvenly} className="text-[#2c317b] hover:underline dark:text-white">
            Split evenly
          </button>
          <button type="button" onClick={() => setPcts(Array(12).fill(""))} className="text-slate-500 hover:underline dark:text-white/60">
            Clear all
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3 dark:border-white/15">
        <div className="flex justify-between text-xs">
          <span className="text-slate-600 dark:text-white/70">
            Phased <b className="tabular-nums">{sum.toFixed(2)}%</b> of <b>100%</b> ({fmt((sum * total) / 100)})
          </span>
          <span className={cn("font-semibold tabular-nums", over ? "text-red-600 dark:text-red-300" : "text-slate-600 dark:text-white/70")}>
            {over ? `Over by ${fmt(-remaining)}%` : `Remaining ${fmt(remaining)}%`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className={cn("h-full rounded-full transition-[width]", over ? "bg-red-500" : "bg-[#2c317b] dark:bg-white")}
            style={{ width: `${Math.min(100, sum)}%` }}
          />
        </div>
      </div>

      <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-white/60">
            <tr>
              <th className="px-3 py-2 font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">Share (%)</th>
              <th className="px-3 py-2 text-right font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((name, i) => {
              const v = parse(pcts[i]);
              return (
                <tr key={name} className="border-t border-slate-100 dark:border-white/10">
                  <td className="px-3 py-1.5">{name}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      inputMode="decimal"
                      aria-label={`${name} percent`}
                      value={pcts[i]}
                      onChange={(e) => setPcts((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                      placeholder="0"
                      className={cn(inputBase, "!h-8 !w-28 !px-2 !py-1 !text-right !text-xs")}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 dark:text-white/60">
                    {v > 0 ? fmt((v * total) / 100) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/70">
        <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
        Apply this phasing to all districts of this target
      </label>

      {serverError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
          {serverError}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[11px] text-slate-500 dark:text-white/60">Months left blank get no share.</p>
        <div className="flex gap-2">
          <Button onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} loading={save.isPending} disabled={over}>
            Save phasing
          </Button>
        </div>
      </div>
    </div>
  );
}