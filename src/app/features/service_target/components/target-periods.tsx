"use client";

import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { ServiceTypeTarget } from "../../../../lib/api/types";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { formatDate } from "../../../../lib/utils";
import { usePeriods, useSetPeriods } from "../hooks";

const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

type Draft = { key: string; id: string | null; start_date: string; end_date: string; target_value: string };

const input =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-white/20 dark:bg-white/5 dark:text-white";

/** Period breakdown of one target: read-only for everyone, editable for admins. */
export function TargetPeriods({ target }: { target: ServiceTypeTarget }) {
  const isAdmin = useIsAdmin();
  const { data, isLoading, isError, error, refetch } = usePeriods(target.id);
  const save = useSetPeriods();
  const [drafts, setDrafts] = useState<Draft[] | null>(null); // null = not editing
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) {
    return <div className="h-16 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" aria-hidden />;
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-300">
        <TriangleAlert size={16} aria-hidden />
        <span>{error?.message ?? "Couldn’t load periods."}</span>
        <button type="button" onClick={() => void refetch()} className="font-semibold underline">
          Try again
        </button>
      </div>
    );
  }

  const periods = [...(data ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const targetValue = Number(target.target_value);

  // ---------- edit mode ----------
  const startEdit = () => {
    setFormError(null);
    setDrafts(
      periods.map((p) => ({
        key: p.id,
        id: p.id,
        start_date: p.start_date,
        end_date: p.end_date,
        target_value: String(Number(p.target_value)),
      })),
    );
  };

  const addRow = () =>
    setDrafts((d) => [
      ...(d ?? []),
      {
        key: crypto.randomUUID(),
        id: null,
        start_date: target.start_date,
        end_date: target.end_date,
        target_value: "0",
      },
    ]);

  const patchRow = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => (d ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key: string) => setDrafts((d) => (d ?? []).filter((r) => r.key !== key));

  const validate = (rows: Draft[]): string | null => {
    for (const r of rows) {
      if (!r.start_date || !r.end_date) return "Every period needs a start and end date.";
      if (r.end_date < r.start_date) return "A period's end date must be on or after its start date.";
      if (r.start_date < target.start_date || r.end_date > target.end_date)
        return `Periods must stay within ${formatDate(target.start_date)} – ${formatDate(target.end_date)}.`;
      const v = Number(r.target_value);
      if (!Number.isFinite(v) || v < 0) return "Period targets must be 0 or more.";
    }
    const sorted = [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start_date <= sorted[i - 1].end_date) return "Periods cannot overlap.";
    }
    const sum = rows.reduce((s, r) => s + Number(r.target_value), 0);
    if (sum > targetValue + 0.005) return `Periods total ${fmt(sum)}, which is more than the target (${fmt(targetValue)}).`;
    return null;
  };

  const onSave = () => {
    if (!drafts) return;
    const problem = validate(drafts);
    if (problem) return setFormError(problem);
    setFormError(null);
    save.mutate(
      {
        id: target.id,
        periods: drafts.map((r) => ({
          id: r.id,
          start_date: r.start_date,
          end_date: r.end_date,
          target_value: Number(r.target_value),
        })),
      },
      {
        onSuccess: () => setDrafts(null),
        onError: (e) => setFormError(e.message),
      },
    );
  };

  if (drafts) {
    const total = drafts.reduce((s, r) => s + (Number(r.target_value) || 0), 0);
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-white/60">
                <th scope="col" className="py-2 pr-2">Start</th>
                <th scope="col" className="py-2 pr-2">End</th>
                <th scope="col" className="py-2 pr-2 text-right">Target</th>
                <th scope="col" className="w-10 py-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((r) => (
                <tr key={r.key}>
                  <td className="py-1 pr-2">
                    <input
                      type="date"
                      className={input}
                      value={r.start_date}
                      min={target.start_date}
                      max={target.end_date}
                      onChange={(e) => patchRow(r.key, { start_date: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="date"
                      className={input}
                      value={r.end_date}
                      min={target.start_date}
                      max={target.end_date}
                      onChange={(e) => patchRow(r.key, { end_date: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${input} text-right tabular-nums`}
                      value={r.target_value}
                      onChange={(e) => patchRow(r.key, { target_value: e.target.value })}
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      aria-label="Remove period"
                      className="rounded p-1 text-slate-500 hover:text-red-600 dark:text-white/60"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
              {drafts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-sm text-slate-600 dark:text-white/70">
                    No periods. Saving will clear all periods for this target.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" onClick={addRow} className="inline-flex items-center gap-1 font-semibold text-[#2c317b] hover:underline dark:text-white">
            <Plus size={14} aria-hidden /> Add period
          </button>
          <span className="tabular-nums text-slate-600 dark:text-white/70">
            Total {fmt(total)} of {fmt(targetValue)} · Remaining {fmt(targetValue - total)}
          </span>
        </div>

        {formError && (
          <p role="alert" className="flex items-center gap-2 text-sm text-red-600 dark:text-red-300">
            <TriangleAlert size={16} aria-hidden /> {formError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={save.isPending}
            className="rounded-md bg-[#2c317b] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save periods"}
          </button>
          <button
            type="button"
            onClick={() => setDrafts(null)}
            disabled={save.isPending}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:underline dark:text-white/80"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ---------- read-only mode ----------
  const pct = (value: number) => (targetValue > 0 ? `${((value / targetValue) * 100).toFixed(1)}%` : "—");
  const total = periods.reduce((sum, p) => sum + Number(p.target_value), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-white/60">
          Within {formatDate(target.start_date)} – {formatDate(target.end_date)}
        </p>
        {isAdmin && (
          <button type="button" onClick={startEdit} className="text-xs font-semibold text-[#2c317b] hover:underline dark:text-white">
            {periods.length ? "Edit periods" : "Add periods"}
          </button>
        )}
      </div>

      {periods.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-white/70">No period targets set for this target yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-white/60">
                <th scope="col" className="py-2 pr-4">Period</th>
                <th scope="col" className="py-2 pr-4 text-right">Target</th>
                <th scope="col" className="py-2 text-right">Share of target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-white/10 dark:text-white/80">
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4">{formatDate(p.start_date)} – {formatDate(p.end_date)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(Number(p.target_value))}</td>
                  <td className="py-2 text-right tabular-nums">{pct(Number(p.target_value))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold text-slate-900 dark:border-white/10 dark:text-white">
                <td className="py-2 pr-4">Total in periods</td>
                <td className="py-2 pr-4 text-right tabular-nums">{fmt(total)}</td>
                <td className="py-2 text-right tabular-nums">{pct(total)}</td>
              </tr>
              <tr className="text-slate-600 dark:text-white/70">
                <td className="py-1 pr-4">Not yet in a period</td>
                <td className="py-1 pr-4 text-right tabular-nums">{fmt(Math.max(targetValue - total, 0))}</td>
                <td className="py-1 text-right tabular-nums">{pct(Math.max(targetValue - total, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}