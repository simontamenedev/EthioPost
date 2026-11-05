"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { AuditLog, AuditStamp, UserRef } from "../../lib/api/types";
import { cn } from "../../lib/utils";

export type DetailItem = { label: string; value: ReactNode };

export const formatDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

const who = (u?: UserRef | null) => (u ? u.full_name || u.email : "—");

const ACTION_TONE: Record<string, { badge: string; dot: string }> = {
  create: {
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  update: {
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  delete: {
    badge: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const muted = "text-slate-500 dark:text-white/60";

/* ───────────── audit value formatting ───────────── */

/** Technical columns that add noise to the history. */
const HIDDEN_ALWAYS = new Set(["updated_at", "updated_by"]);
const HIDDEN_SNAPSHOT = new Set([...HIDDEN_ALWAYS, "id", "created_at", "created_by", "deleted_by"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** "district_id" → "District", "agent_shortcode" → "Agent shortcode". */
function humanize(key: string): string {
  const text = key.replace(/_id$/, "").replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function AuditValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "")
    return <span className="italic text-slate-400 dark:text-white/40">empty</span>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (typeof value === "number") return <span className="tabular-nums">{value.toLocaleString()}</span>;
  if (typeof value === "object")
    return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10">{JSON.stringify(value)}</code>;
  const text = String(value);
  if (ISO_DATE.test(text) && !Number.isNaN(Date.parse(text))) return <>{new Date(text).toLocaleString()}</>;
  if (UUID.test(text)) return <span className="break-all font-mono text-[11px]">{text}</span>;
  return <>{text}</>;
}

/* ───────────── panel ───────────── */

type DetailPanelProps = {
  title: string;
  subtitle?: string;
  items: DetailItem[];
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  /** Admin-only section. Leave false for everyone else. */
  showAudit?: boolean;
  audit?: AuditStamp | null;
  logs?: AuditLog[];
  logsLoading?: boolean;
  logsError?: string | null;
};

export function DetailPanel({
  title, subtitle, items, isLoading, error, onClose,
  showAudit = false, audit, logs, logsLoading, logsError,
}: DetailPanelProps) {
  return (
    <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 lg:sticky lg:top-6 lg:w-[26rem] lg:self-start">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className={cn("text-xs", muted)}>{subtitle}</p>}
        </div>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      {isLoading && <p className={cn("mt-6 text-sm", muted)}>Loading…</p>}
      {error && <p className="mt-6 text-sm text-red-600 dark:text-red-300">{error}</p>}

      {!isLoading && !error && (
        <div className="mt-5 max-h-[calc(100vh-10rem)] space-y-6 overflow-y-auto pr-1">
          <dl className="space-y-3">
            {items.map((i) => (
              <div key={i.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/50">{i.label}</dt>
                <dd className="mt-0.5 break-words text-sm text-slate-900 dark:text-white">{i.value ?? "—"}</dd>
              </div>
            ))}
          </dl>

          {showAudit && (
            <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/10">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Audit</h3>

              <dl className="grid grid-cols-2 gap-3 text-sm text-slate-900 dark:text-white">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-white/50">Created by</dt>
                  <dd className="break-words">{who(audit?.created_by)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-white/50">Last updated by</dt>
                  <dd className="break-words">{who(audit?.updated_by)}</dd>
                </div>
              </dl>

              {logsLoading && <p className={cn("text-xs", muted)}>Loading history…</p>}
              {logsError && <p className="text-xs text-red-600 dark:text-red-300">{logsError}</p>}
              {!logsLoading && !logsError && logs && logs.length === 0 && (
                <p className={cn("text-xs", muted)}>No audit entries.</p>
              )}
              {!!logs?.length && (
                <ol className="relative ml-1.5 space-y-4 border-l border-slate-200 pl-5 dark:border-white/15">
                  {logs.map((l) => (
                    <LogEntry key={l.id} log={l} />
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      )}
    </aside>
  );
}

/* ───────────── one history entry ───────────── */

function LogEntry({ log }: { log: AuditLog }) {
  const action = log.action.toLowerCase();
  const tone = ACTION_TONE[action];
  const author = log.user ? who(log.user) : (log.user_id?.slice(0, 8) ?? "unknown");

  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn("absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full", tone?.dot ?? "bg-slate-400")}
      />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            tone?.badge ?? "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/80",
          )}
        >
          {log.action}
        </span>
        <span className="text-xs font-medium text-slate-800 dark:text-white/90">{author}</span>
      </div>
      <p className={cn("mt-0.5 text-[11px]", muted)}>
        {formatDateTime(log.created_at)}
        {log.ip_address ? ` · ${log.ip_address}` : ""}
      </p>

      <LogBody log={log} action={action} />
    </li>
  );
}

function LogBody({ log, action }: { log: AuditLog; action: string }) {
  if (action === "update") {
    const keys = Object.keys(log.new_values ?? {}).filter((k) => !HIDDEN_ALWAYS.has(k));
    if (keys.length === 0) return null;
    return (
      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-xs dark:divide-white/10 dark:border-white/10">
        {keys.map((k) => (
          <li key={k} className="space-y-1 px-3 py-2">
            <p className="font-medium text-slate-600 dark:text-white/70">{humanize(k)}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="max-w-full break-words rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red-300 dark:bg-red-500/10 dark:text-red-300">
                <AuditValue value={log.old_values?.[k]} />
              </span>
              <span aria-hidden className="text-slate-400 dark:text-white/40">→</span>
              <span className="max-w-full break-words rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <AuditValue value={log.new_values?.[k]} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  // create → what was set; delete → what the record looked like
  const source = action === "create" ? log.new_values : log.old_values;
  const entries = Object.entries(source ?? {}).filter(([k]) => !HIDDEN_SNAPSHOT.has(k));
  if (entries.length === 0) return null;

  return (
    <details className="group mt-2 rounded-lg border border-slate-200 text-xs dark:border-white/10">
      <summary
        className={cn(
          "flex cursor-pointer select-none list-none items-center justify-between px-3 py-2 font-medium text-slate-700 dark:text-white/80",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span>{action === "create" ? "Initial values" : "Values before delete"}</span>
        <span className={cn("flex items-center gap-1", muted)}>
          {entries.length} fields
          <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <dl className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-white/10 dark:border-white/10">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 px-3 py-1.5">
            <dt className={cn("truncate", muted)} title={humanize(k)}>{humanize(k)}</dt>
            <dd className="min-w-0 break-words text-slate-900 dark:text-white">
              <AuditValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}