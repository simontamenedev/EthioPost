"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../../components/ui/button";
import { Modal } from "../../../../components/ui/modal";
import { inputBase } from "../../../../components/ui/styles";
import { errorMessage } from "../../../../lib/api/client";
import type { DistrictAllocationRow, ServiceTypeTarget } from "../../../../lib/api/types";

type TargetRef = Pick<ServiceTypeTarget, "id" | "target_value">;
import { cn } from "../../../../lib/utils";
import { useSetDistrictTargets, useTargetDistricts } from "../hooks";

type Mode = "value" | "percent";
type Amounts = Record<string, string>; // district_id -> raw input text

const EPS = 0.005;
const parse = (s: string | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const text = (n: number) => (n > 0 ? String(round2(n)) : "");

export function DistrictAllocationEditor({
  target,
  open,
  onClose,
}: {
  target: TargetRef;
  open: boolean;
  onClose: () => void;
}) {
  const query = useTargetDistricts(target.id, open);
  const ready = open && query.data && !query.isFetching;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="District allocation"
      description="Split the annual target across districts by value or by percentage."
    >
      {ready ? (
        <AllocationForm target={target} rows={query.data!} onClose={onClose} />
      ) : (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-white/60">
          {query.isError ? errorMessage(query.error) : "Loading districts…"}
        </p>
      )}
    </Modal>
  );
}

function AllocationForm({
  target,
  rows,
  onClose,
}: {
  target: TargetRef;
  rows: DistrictAllocationRow[];
  onClose: () => void;
}) {
  const save = useSetDistrictTargets();
  const total = Number(target.target_value);

  const [mode, setMode] = useState<Mode>("value");
  const [amounts, setAmounts] = useState<Amounts>(() =>
    Object.fromEntries(rows.map((r) => [r.district_id, text(Number(r.target_value))])),
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const limit = mode === "value" ? total : 100;
  const sum = rows.reduce((acc, r) => acc + parse(amounts[r.district_id]), 0);
  const remaining = limit - sum;
  const over = sum > limit + EPS;
  const sumValue = mode === "value" ? sum : (sum * total) / 100;
  const sumPercent = mode === "percent" ? sum : total ? (sum / total) * 100 : 0;

  function switchMode(next: Mode) {
    if (next === mode) return;
    setAmounts((prev) =>
      Object.fromEntries(
        rows.map((r) => {
          const v = parse(prev[r.district_id]);
          return [r.district_id, text(next === "percent" ? (total ? (v / total) * 100 : 0) : (v * total) / 100)];
        }),
      ),
    );
    setMode(next);
  }

  function splitEvenly() {
    const n = rows.length;
    if (!n) return;
    const whole = mode === "value" ? total : 100;
    const share = Math.floor((whole / n) * 100) / 100;
    const first = round2(whole - share * (n - 1)); // the first district absorbs the rounding remainder
    setAmounts(Object.fromEntries(rows.map((r, i) => [r.district_id, text(i === 0 ? first : share)])));
  }

  async function submit() {
    setServerError(null);
    try {
      await save.mutateAsync({
        id: target.id,
        data: {
          mode,
          allocations: rows
            .filter((r) => parse(amounts[r.district_id]) > 0)
            .map((r) => ({ district_id: r.district_id, amount: parse(amounts[r.district_id]) })),
        },
      });
      toast.success("District allocation saved");
      onClose();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  const barWidth = Math.min(100, (sum / (limit || 1)) * 100);

  return (
    <div className="space-y-3">
      {/* Mode toggle + quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Allocate by" className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/15">
          {(["value", "percent"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition",
                mode === m
                  ? "bg-[#2c317b] text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10",
              )}
            >
              {m === "value" ? "By value" : "By percent"}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <button type="button" onClick={splitEvenly} className="text-[#2c317b] hover:underline dark:text-white">
            Split evenly
          </button>
          <button type="button" onClick={() => setAmounts({})} className="text-slate-500 hover:underline dark:text-white/60">
            Clear all
          </button>
        </div>
      </div>

      {/* Live totals */}
      <div className="rounded-lg border border-slate-200 p-3 dark:border-white/15">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
          <span className="text-slate-600 dark:text-white/70">
            Allocated <b className="tabular-nums">{fmt(sumValue)}</b> of <b className="tabular-nums">{fmt(total)}</b>{" "}
            ({sumPercent.toFixed(2)}%)
          </span>
          <span className={cn("font-semibold tabular-nums", over ? "text-red-600 dark:text-red-300" : "text-slate-600 dark:text-white/70")}>
            {over
              ? `Over by ${fmt(-remaining)}${mode === "percent" ? "%" : ""}`
              : `Remaining ${fmt(remaining)}${mode === "percent" ? "%" : ""}`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className={cn("h-full rounded-full transition-[width]", over ? "bg-red-500" : "bg-[#2c317b] dark:bg-white")}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* One row per district */}
      <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-white/60">
            <tr>
              <th className="px-3 py-2 font-medium">District</th>
              <th className="px-3 py-2 text-right font-medium">{mode === "value" ? "Target" : "Share (%)"}</th>
              <th className="px-3 py-2 text-right font-medium">{mode === "value" ? "Share" : "Target"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = parse(amounts[r.district_id]);
              const other = mode === "value" ? (total ? (v / total) * 100 : 0) : (v * total) / 100;
              return (
                <tr key={r.district_id} className="border-t border-slate-100 dark:border-white/10">
                  <td className="px-3 py-1.5">{r.district_name}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      aria-label={`${r.district_name} ${mode === "value" ? "target" : "percent"}`}
                      value={amounts[r.district_id] ?? ""}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [r.district_id]: e.target.value }))}
                      placeholder="0"
                      className={cn(inputBase, "!h-8 !w-32 !px-2 !py-1 !text-right !text-xs")}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 dark:text-white/60">
                    {v > 0 ? (mode === "value" ? `${other.toFixed(2)}%` : fmt(other)) : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-slate-500 dark:text-white/60">
                  No active districts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {serverError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
          {serverError}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[11px] text-slate-500 dark:text-white/60">
          Districts left blank get no share. Saving with everything blank clears the split.
        </p>
        <div className="flex gap-2">
          <Button onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} loading={save.isPending} disabled={over}>
            Save split
          </Button>
        </div>
      </div>
    </div>
  );
}