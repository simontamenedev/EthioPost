"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Folder,
  Link2,
  List,
  RotateCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../../../components/ui/badge";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { focusRing } from "../../../../components/ui/styles";
import { ApiError, apiDownload, errorMessage } from "../../../../lib/api/client";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { cn } from "../../../../lib/utils";
import type { DatasetKey, ImportBatch } from "../../../../lib/api/analytics-types";

import { uploadSchema } from "../schema";
import { useDeleteImport, useImports, useRelinkAgents, useUploadCsv } from "../hooks/use-imports";
import { card, pageDescription, pageShell, pageTitle } from "../../analytics/styles/styles";

/* ───────────────────────────── constants & types ───────────────────────────── */

/** Each dataset is a folder. */
const LABELS: Record<DatasetKey, string> = {
  transactions: "Transactions",
  registrations: "Customer Registration",
  upgrades: "Customer Upgradation",
};
const ORDER: DatasetKey[] = ["transactions", "registrations", "upgrades"];
const ROOT = "Documents";

type View = "details" | "list" | "tiles" | "icons";
const VIEWS: { id: View; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "list", label: "List" },
  { id: "tiles", label: "Tiles" },
  { id: "icons", label: "Icons" },
];

type SortKey = "name" | "modified" | "period" | "imported" | "duplicates" | "invalid" | "unmatched";
type Sort = { key: SortKey; dir: "asc" | "desc" };
const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  modified: "Date modified",
  period: "Period",
  imported: "Rows imported",
  duplicates: "Duplicates",
  invalid: "Invalid rows",
  unmatched: "Unknown agents",
};
const FOLDER_SORTS: SortKey[] = ["name", "modified"];
const FILE_SORTS = Object.keys(SORT_LABELS) as SortKey[];

type Entry = {
  id: string;
  kind: "folder" | "file";
  name: string;
  dataset: DatasetKey;
  modified: string | null;
  count: number;
  batch?: ImportBatch;
};

type Problem = { title: string; message: string };

/* ───────────────────────────── helpers ───────────────────────────── */

/** Turns raw API/network errors into a clear, professional message. */
function friendlyError(error: unknown): Problem {
  if (error instanceof ApiError) {
    if (error.status === 0)
      return { title: "Connection problem", message: "We couldn't reach the server. Check your connection and try again." };
    if (error.status === 403)
      return { title: "Permission required", message: "Your account isn't allowed to import data. Please contact an administrator." };
    if (error.status === 413)
      return { title: "File too large", message: "The file exceeds the upload limit. Split it into smaller files and try again." };
    if (error.status === 400 || error.status === 422)
      return { title: "The file could not be imported", message: error.message };
    if (error.status >= 500)
      return { title: "Server error", message: "Something went wrong on our side. Please try again in a few minutes." };
  }
  return { title: "Import failed", message: errorMessage(error) };
}

/** "Today, 10:42 AM" · "Yesterday, 4:16 PM" · "May 21, 2025, 2:08 PM" */
function formatModified(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86_400_000);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, ${time}`;
}

const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? "item" : "items"}`;
const periodText = (b: ImportBatch) => `${b.date_from ?? "—"} → ${b.date_to ?? "—"}`;
const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

function sortValue(e: Entry, key: SortKey): string | number {
  const b = e.batch;
  switch (key) {
    case "modified": return e.modified ? new Date(e.modified).getTime() : 0;
    case "period": return b?.date_from ?? "";
    case "imported": return b?.rows_imported ?? 0;
    case "duplicates": return b?.rows_duplicate ?? 0;
    case "invalid": return b?.rows_invalid ?? 0;
    case "unmatched": return b?.rows_unmatched ?? 0;
    default: return e.name;
  }
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

function compareEntries(a: Entry, b: Entry, sort: Sort): number {
  const x = sortValue(a, sort.key);
  const y = sortValue(b, sort.key);
  const r = typeof x === "number" && typeof y === "number" ? x - y : byText(String(x), String(y));
  return (sort.dir === "asc" ? r : -r) || byText(a.name, b.name);
}

/* ───────────────────────────── small UI pieces ───────────────────────────── */

const cmdBtn = cn(
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:text-white/85 dark:hover:bg-white/10",
  focusRing,
);
const menuPanel =
  "absolute left-0 top-full z-40 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/15 dark:bg-[#1d2170]";
const itemBase =
  "cursor-default select-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2c317b] dark:focus-visible:outline-[#f3ad1c]";

function FolderIcon({ size = 20 }: { size?: number }) {
  return <Folder size={size} strokeWidth={1.4} className="shrink-0 fill-[#f3ad1c] text-[#f3ad1c]" />;
}
function FileIcon({ size = 20 }: { size?: number }) {
  return <FileSpreadsheet size={size} strokeWidth={1.5} className="shrink-0 text-emerald-600 dark:text-emerald-400" />;
}
const EntryIcon = ({ e, size }: { e: Entry; size: number }) => (e.kind === "folder" ? <FolderIcon size={size} /> : <FileIcon size={size} />);

function MenuItem({
  checked, danger, disabled, onClick, children,
}: { checked?: boolean; danger?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-40",
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
          : "text-slate-700 hover:bg-slate-100 dark:text-white/85 dark:hover:bg-white/10",
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{checked && <Check size={14} />}</span>
      {children}
    </button>
  );
}

function Dropdown({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cmdBtn}>
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown size={14} className="text-slate-500 dark:text-white/60" />
      </button>
      {open && (
        <div role="menu" className={menuPanel} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function Alert({ title, message, onDismiss }: Problem & { onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm opacity-90">{message}</p>
      </div>
      {onDismiss && (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} className={cn("rounded-md p-1 hover:bg-red-100 dark:hover:bg-red-500/20", focusRing)}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warn" }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3.5 py-2.5 dark:border-white/10">
      <p className="text-xs text-slate-500 dark:text-white/60">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold", tone === "warn" && value > 0 ? "text-amber-600 dark:text-amber-300" : "text-slate-900 dark:text-white")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ───────────────────────────── details-view columns ───────────────────────────── */

type Col = { key: SortKey | null; header: string; w: string; cell: (e: Entry) => ReactNode };

const nameCell = (e: Entry) => (
  <span className="flex min-w-0 items-center gap-3">
    <EntryIcon e={e} size={22} />
    <span className="truncate">{e.name}</span>
  </span>
);
const onBatch = (fn: (b: ImportBatch) => ReactNode) => (e: Entry) => (e.batch ? fn(e.batch) : null);
const warn = (n: number) => (n > 0 ? "font-semibold text-amber-600 dark:text-amber-300" : "");

const ROOT_COLS: Col[] = [
  { key: "name", header: "Name", w: "w-[46%]", cell: nameCell },
  { key: "modified", header: "Date modified", w: "w-[24%]", cell: (e) => formatModified(e.modified) },
  { key: null, header: "Type", w: "w-[18%]", cell: () => "File folder" },
  { key: null, header: "Items", w: "w-[12%]", cell: (e) => e.count.toLocaleString() },
];
const FILE_COLS: Col[] = [
  { key: "name", header: "Name", w: "w-[27%]", cell: nameCell },
  { key: "modified", header: "Date modified", w: "w-[16%]", cell: (e) => formatModified(e.modified) },
  { key: null, header: "Type", w: "w-[8%]", cell: () => "CSV file" },
  { key: "period", header: "Period", w: "w-[17%]", cell: onBatch(periodText) },
  { key: "imported", header: "Imported", w: "w-[10%]", cell: onBatch((b) => `${b.rows_imported} / ${b.rows_total}`) },
  { key: "duplicates", header: "Duplicates", w: "w-[8%]", cell: onBatch((b) => b.rows_duplicate) },
  { key: "invalid", header: "Invalid", w: "w-[6%]", cell: onBatch((b) => <span className={warn(b.rows_invalid)}>{b.rows_invalid}</span>) },
  { key: "unmatched", header: "Unknown agents", w: "w-[8%]", cell: onBatch((b) => <span className={warn(b.rows_unmatched)}>{b.rows_unmatched}</span>) },
];

/* ───────────────────────────── main component ───────────────────────────── */

const VIEW_LIMIT = 500;

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Small RFC-4180 style CSV parser (quotes, escaped quotes, CRLF, comma or semicolon). */
function parseCsv(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

type ViewerState =
  | { status: "loading" }
  | { status: "error"; problem: Problem }
  | { status: "ready"; text: string; blob: Blob };

/** Read-only preview of an uploaded CSV, with a download button to open it in any editor. */
function FileViewer({ batch, file, onClose }: { batch: ImportBatch; file: File | undefined; onClose: () => void }) {
  const [state, setState] = useState<ViewerState>({ status: "loading" });
  const [mode, setMode] = useState<"table" | "text">("table");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Files uploaded in this session are cached; otherwise ask the API for the stored copy.
        const blob: Blob = file ?? (await apiDownload(`/imports/${batch.id}/file`)).blob;
        const text = await blob.text();
        if (alive) setState({ status: "ready", text, blob });
      } catch (error) {
        if (!alive) return;
        const missing = error instanceof ApiError && (error.status === 404 || error.status === 405);
        setState({
          status: "error",
          problem: missing
            ? { title: "File not available", message: "Only files uploaded in this session can be previewed. Upload the file again to view it." }
            : friendlyError(error),
        });
      }
    })();
    return () => { alive = false; };
  }, [batch.id, file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const rows = useMemo(() => (state.status === "ready" ? parseCsv(state.text) : []), [state]);
  const header = rows[0] ?? [];
  const body = useMemo(() => rows.slice(1), [rows]);
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(() => (needle ? body.filter((r) => r.some((c) => c.toLowerCase().includes(needle))) : body), [body, needle]);
  const shown = filtered.slice(0, VIEW_LIMIT);

  function download() {
    if (state.status !== "ready") return;
    const url = URL.createObjectURL(state.blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: batch.filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const toggle = (id: "table" | "text", label: string) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      aria-pressed={mode === id}
      className={cn("rounded-md px-3 py-1 text-sm", mode === id ? "bg-white font-semibold text-slate-900 shadow-sm dark:bg-white/20 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white", focusRing)}
    >
      {label}
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${batch.filename}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/10 dark:bg-[#161a5c] dark:text-white dark:[color-scheme:dark]">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <FileIcon size={24} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{batch.filename}</p>
            <p className="truncate text-xs text-slate-500 dark:text-white/60">
              {state.status === "ready"
                ? `${body.length.toLocaleString()} rows · ${header.length} columns · ${formatSize(state.blob.size)}`
                : `${LABELS[batch.dataset]} · ${formatModified(batch.created_at)}`}
            </p>
          </div>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-white/10">
            {toggle("table", "Table")}
            {toggle("text", "Text")}
          </div>
          {mode === "table" && (
            <div className="flex h-9 w-44 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 dark:border-white/20 dark:bg-white/5 sm:w-56">
              <Search size={14} className="shrink-0 text-slate-500 dark:text-white/60" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search rows"
                placeholder="Search rows"
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-white/50"
              />
            </div>
          )}
          <button type="button" onClick={download} disabled={state.status !== "ready"} title="Download to open in Excel or any editor" className={cmdBtn}>
            <Download size={16} />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button type="button" aria-label="Close preview" onClick={onClose} className={cn("rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10", focusRing)}>
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {state.status === "loading" ? (
            <div aria-hidden className="animate-pulse space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 rounded-md bg-slate-100 dark:bg-white/10" />
              ))}
            </div>
          ) : state.status === "error" ? (
            <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
              <AlertCircle size={28} className="text-red-600 dark:text-red-300" />
              <p className="font-semibold text-slate-900 dark:text-white">{state.problem.title}</p>
              <p className="max-w-md text-sm text-slate-600 dark:text-white/70">{state.problem.message}</p>
            </div>
          ) : mode === "text" ? (
            <pre className="whitespace-pre p-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-white/90">{state.text.slice(0, 200_000)}</pre>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#1d2170]">
                <tr>
                  <th className="w-12 border-b border-slate-200 px-3 py-2 text-right text-xs font-normal text-slate-500 dark:border-white/10 dark:text-white/60">#</th>
                  {header.map((h, i) => (
                    <th key={i} className="whitespace-nowrap border-b border-l border-slate-200 px-3 py-2 text-left font-semibold text-slate-800 dark:border-white/10 dark:text-white">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, ri) => (
                  <tr key={ri} className="even:bg-slate-50/70 hover:bg-sky-50 dark:even:bg-white/[0.03] dark:hover:bg-white/5">
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-400 dark:text-white/40">{ri + 1}</td>
                    {header.map((_, ci) => (
                      <td key={ci} title={r[ci]} className="max-w-[320px] truncate border-l border-slate-100 px-3 py-1.5 text-slate-800 dark:border-white/5 dark:text-white/90">
                        {r[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {state.status === "ready" && mode === "table" && (
          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-white/10 dark:text-white/70">
            Showing {shown.length.toLocaleString()} of {filtered.length.toLocaleString()} rows
            {filtered.length > VIEW_LIMIT && ". Download the file to see everything"}
          </div>
        )}
      </div>
    </div>
  );
}

export function ImportsView() {
  const isAdmin = useIsAdmin();
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<DatasetKey>("transactions");

  // explorer state
  const [openFolder, setOpenFolder] = useState<DatasetKey | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<View>("details");
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });
  const [query, setQuery] = useState("");
  const [dropId, setDropId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; entry: Entry } | null>(null);

  // upload / delete state (same logic as before)
  const [uploading, setUploading] = useState<string | null>(null);
  const [formError, setFormError] = useState<Problem | null>(null);
  const [toRollback, setToRollback] = useState<ImportBatch | null>(null);
  const [viewing, setViewing] = useState<ImportBatch | null>(null);
  const filesRef = useRef(new Map<string, File>()); // uploaded files kept for preview this session

  const batches = useImports();
  const upload = useUploadCsv();
  const remove = useDeleteImport();
  const relink = useRelinkAgents();
  const last = upload.data;

  // close the context menu on any click / scroll / Escape
  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [ctx]);

  const all = useMemo(() => batches.data ?? [], [batches.data]);
  const available = openFolder ? FILE_SORTS : FOLDER_SORTS;
  const activeKey: SortKey = available.includes(sort.key) ? sort.key : "name";

  const entries = useMemo<Entry[]>(() => {
    let list: Entry[];
    if (openFolder) {
      list = all
        .filter((b) => b.dataset === openFolder)
        .map((b) => ({ id: b.id, kind: "file", name: b.filename, dataset: b.dataset, modified: b.created_at, count: 1, batch: b }));
    } else {
      list = ORDER.map((ds) => {
        const files = all.filter((b) => b.dataset === ds);
        const modified = files.reduce<string | null>((m, b) => (!m || b.created_at > m ? b.created_at : m), null);
        return { id: `folder:${ds}`, kind: "folder", name: LABELS[ds], dataset: ds, modified, count: files.length };
      });
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => compareEntries(a, b, { key: activeKey, dir: sort.dir }));
  }, [all, openFolder, query, activeKey, sort.dir]);

  const selected = entries.find((e) => e.id === sel) ?? null;
  const uploadTarget: DatasetKey | null = openFolder ?? (selected?.kind === "folder" ? selected.dataset : null);

  /* ── navigation ── */
  function openDataset(ds: DatasetKey) {
    setOpenFolder(ds);
    setSel(null);
    setQuery("");
  }
  function goRoot() {
    setOpenFolder(null);
    setSel(null);
    setQuery("");
  }
  function toggleSort(key: SortKey) {
    setSort((s) => (activeKey === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "modified" ? "desc" : "asc" }));
  }

  /* ── upload (same validation + mutation as before, now per folder) ── */
  function startUpload(ds: DatasetKey) {
    targetRef.current = ds;
    inputRef.current?.click();
  }

  async function uploadFiles(ds: DatasetKey, files: File[]) {
    setFormError(null);
    for (const f of files) {
      if (!/\.csv$/i.test(f.name)) {
        setFormError({ title: "Unsupported file type", message: `“${f.name}” is not a .csv file. Only CSV reports exported from the agent monitoring system are accepted.` });
        return;
      }
      const parsed = uploadSchema.safeParse({ dataset: ds, file: f });
      if (!parsed.success) {
        setFormError({ title: "Check your upload", message: parsed.error.issues[0].message });
        return;
      }
      setUploading(f.name);
      try {
        const batch = await upload.mutateAsync(parsed.data);
        toast.success("Import complete", { description: `${batch.rows_imported.toLocaleString()} rows imported from ${batch.filename}.` });
        filesRef.current.set(batch.id, f);
        setSel(batch.id);
      } catch (error) {
        const p = friendlyError(error);
        setFormError({ title: p.title, message: `${f.name}: ${p.message}` });
        return;
      } finally {
        setUploading(null);
      }
    }
  }

  /* ── delete (roll back) / relink (same logic as before) ── */
  async function confirmRollback() {
    if (!toRollback) return;
    try {
      await remove.mutateAsync(toRollback.id);
      toast.success("File deleted", { description: `${toRollback.filename} and its imported rows were removed. You can upload it again.` });
      filesRef.current.delete(toRollback.id);
      setSel(null);
    } catch (error) {
      toast.error("Couldn't delete the file", { description: friendlyError(error).message });
    }
    setToRollback(null);
  }

  async function handleRelink() {
    try {
      const res = await relink.mutateAsync();
      const n = Object.values(res).reduce((a, b) => a + b, 0);
      if (n) toast.success("Agents linked", { description: `${n.toLocaleString()} rows were linked to agents.` });
      else toast.info("Nothing to link", { description: "All imported rows are already linked to agents." });
    } catch (error) {
      toast.error("Couldn't link agents", { description: friendlyError(error).message });
    }
  }

  /* ── keyboard / drag handlers ── */
  function onKeyDown(ev: React.KeyboardEvent) {
    if ((ev.target as HTMLElement).closest("input, select, textarea")) return;
    if (ev.key === "Delete" && selected?.batch) {
      ev.preventDefault();
      setToRollback(selected.batch);
    } else if (ev.key === "Enter" && selected?.kind === "folder") {
      openDataset(selected.dataset);
    } else if (ev.key === "Enter" && selected?.batch) {
      setViewing(selected.batch);
    } else if ((ev.key === "Backspace" || (ev.altKey && ev.key === "ArrowUp")) && openFolder) {
      ev.preventDefault();
      goRoot();
    } else if (ev.key === "Escape") {
      setSel(null);
    }
  }

  function paneDragOver(ev: React.DragEvent) {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    if (openFolder) setDropId("pane");
  }
  function paneDragLeave(ev: React.DragEvent) {
    if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setDropId(null);
  }
  function paneDrop(ev: React.DragEvent) {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    setDropId(null);
    const files = Array.from(ev.dataTransfer.files);
    if (openFolder) void uploadFiles(openFolder, files);
    else toast.info("Drop onto a folder", { description: "Drag the file onto Transactions, Customer Registration or Customer Upgradation." });
  }

  /* ── per-item behaviour shared by every view ── */
  function itemProps(e: Entry) {
    return {
      "data-item": "",
      "aria-selected": sel === e.id,
      tabIndex: 0,
      onClick: () => setSel(e.id),
      onDoubleClick: () => { if (e.kind === "folder") openDataset(e.dataset); else if (e.batch) setViewing(e.batch); },
      onContextMenu: (ev: React.MouseEvent) => {
        ev.preventDefault();
        setSel(e.id);
        setCtx({ x: ev.clientX, y: ev.clientY, entry: e });
      },
      ...(e.kind === "folder"
        ? {
            onDragOver: (ev: React.DragEvent) => {
              if (!hasFiles(ev)) return;
              ev.preventDefault();
              ev.stopPropagation();
              setDropId(e.id);
            },
            onDragLeave: () => setDropId((cur) => (cur === e.id ? null : cur)),
            onDrop: (ev: React.DragEvent) => {
              if (!hasFiles(ev)) return;
              ev.preventDefault();
              ev.stopPropagation();
              setDropId(null);
              void uploadFiles(e.dataset, Array.from(ev.dataTransfer.files));
            },
          }
        : {}),
    };
  }

  function stateCls(e: Entry, boxed: boolean) {
    if (dropId === e.id)
      return cn("bg-sky-50 dark:bg-[#f3ad1c]/10", boxed && "ring-2 ring-inset ring-[#2c317b] dark:ring-[#f3ad1c]");
    if (sel === e.id)
      return cn("bg-sky-100 dark:bg-sky-400/20", boxed && "ring-1 ring-inset ring-sky-300 dark:ring-sky-400/40");
    return "hover:bg-slate-100 dark:hover:bg-white/5";
  }

  const subtitle = (e: Entry) =>
    e.kind === "folder" ? plural(e.count) : e.batch ? `${e.batch.rows_imported.toLocaleString()} rows · ${periodText(e.batch)}` : "";

  /* ── admin gate (hooks above stay unconditional) ── */
  if (!isAdmin) {
    return (
      <div className={pageShell}>
        <h1 className={cn(pageTitle, "dark:text-white")}>Data imports</h1>
        <Badge tone="blue">Admins only</Badge>
      </div>
    );
  }

  const hasWarnings = !!last && (last.rows_invalid > 0 || last.rows_unmatched > 0 || (last.errors?.length ?? 0) > 0);
  const extraErrors = (last?.errors?.length ?? 0) - 10;
  const cols = openFolder ? FILE_COLS : ROOT_COLS;
  const title = openFolder ? LABELS[openFolder] : ROOT;

  /* ── views ── */
  const detailsView = (
    <div className="overflow-x-auto px-2 pb-2">
      <table className={cn("w-full table-fixed border-collapse text-sm", openFolder && "min-w-[880px]")} role="grid" aria-label={title}>
        <thead>
          <tr className="border-b border-slate-200 text-left text-[13px] text-slate-600 dark:border-white/10 dark:text-white/70">
            {cols.map((c, i) => (
              <th
                key={c.header}
                scope="col"
                aria-sort={c.key && activeKey === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                className={cn("p-0 font-normal", c.w, i > 0 && "border-l border-slate-200 dark:border-white/10")}
              >
                {c.key ? (
                  <button type="button" onClick={() => toggleSort(c.key as SortKey)} className={cn("flex w-full items-center gap-1.5 px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-white/5", focusRing)}>
                    <span className="truncate">{c.header}</span>
                    {activeKey === c.key && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                ) : (
                  <span className="block truncate px-3 py-2.5">{c.header}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} role="row" {...itemProps(e)} className={cn(itemBase, stateCls(e, false))}>
              {cols.map((c) => (
                <td key={c.header} className="truncate px-3 py-2.5 text-slate-800 dark:text-white/90">
                  {c.cell(e)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const listView = (
    <div role="listbox" aria-label={title} className="columns-1 gap-x-2 p-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
      {entries.map((e) => (
        <div key={e.id} role="option" {...itemProps(e)} className={cn(itemBase, "mb-0.5 flex break-inside-avoid items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-slate-800 dark:text-white/90", stateCls(e, true))}>
          <EntryIcon e={e} size={18} />
          <span className="truncate">{e.name}</span>
        </div>
      ))}
    </div>
  );

  const tilesView = (
    <div role="listbox" aria-label={title} className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {entries.map((e) => (
        <div key={e.id} role="option" {...itemProps(e)} className={cn(itemBase, "flex items-center gap-3 rounded-md p-2.5", stateCls(e, true))}>
          <EntryIcon e={e} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{e.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-white/60">{e.kind === "folder" ? "File folder" : "CSV file"}</p>
            <p className="truncate text-xs text-slate-500 dark:text-white/60">{subtitle(e)}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const iconsView = (
    <div role="listbox" aria-label={title} className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 p-3">
      {entries.map((e) => (
        <div key={e.id} role="option" {...itemProps(e)} title={e.name} className={cn(itemBase, "flex flex-col items-center gap-2 rounded-md p-3 text-center", stateCls(e, true))}>
          <EntryIcon e={e} size={56} />
          <span className="line-clamp-2 break-words text-sm text-slate-800 dark:text-white/90">{e.name}</span>
        </div>
      ))}
    </div>
  );

  const body = { details: detailsView, list: listView, tiles: tilesView, icons: iconsView }[view];

  return (
    <div className="flex min-h-[calc(100vh-68px)] w-full flex-col gap-5 px-5 py-7 text-slate-900 dark:text-white sm:px-8 lg:px-10">
      <div className="min-w-0">
        <h1 className={cn(pageTitle, "dark:text-white")}>Data imports</h1>
        <p className={cn(pageDescription, "dark:text-white/70")}>Open a folder and upload the agent monitoring CSV reports. Re-uploading overlapping files never creates duplicates.</p>
      </div>

      {formError && <Alert {...formError} onDismiss={() => setFormError(null)} />}

      {last && (
        <div className={card}>
          <div className="flex items-start gap-3">
            {hasWarnings ? (
              <AlertCircle size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
            ) : (
              <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                {hasWarnings ? "Import completed with warnings" : "Import completed successfully"}
              </p>
              <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-white/70">{last.filename}</p>
            </div>
            <button type="button" aria-label="Dismiss summary" onClick={() => upload.reset()} className={cn("rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10", focusRing)}>
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`Imported of ${last.rows_total.toLocaleString()}`} value={last.rows_imported} />
            <Stat label="Already existed" value={last.rows_duplicate} />
            <Stat label="Invalid rows" value={last.rows_invalid} tone="warn" />
            <Stat label="Unknown agents" value={last.rows_unmatched} tone="warn" />
          </div>

          {last.unmatched_shortcodes && last.unmatched_shortcodes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-slate-700 dark:text-white/80">
                These agents are missing from Agents master data. Add them, then select “Link agents”.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {last.unmatched_shortcodes.map((code) => (
                  <span key={code} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-white/10 dark:text-white/80">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {last.errors && last.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-800 dark:text-white/90">Rows that could not be imported</p>
              <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300">
                {last.errors.slice(0, 10).map((er) => (
                  <li key={er.line}>
                    <span className="font-mono text-xs">Line {er.line}</span> · {er.error}
                  </li>
                ))}
              </ul>
              {extraErrors > 0 && (
                <p className="mt-1 text-xs text-slate-500 dark:text-white/60">and {extraErrors.toLocaleString()} more. Fix the file and re-upload; existing rows won’t be duplicated.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ───────── the explorer window ───────── */}
      <div
        onKeyDown={onKeyDown}
        className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-white/10 dark:bg-[#161a5c] dark:text-white dark:[color-scheme:dark]"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          tabIndex={-1}
          aria-hidden
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = ""; // allow picking the same file again
            if (files.length) void uploadFiles(targetRef.current, files);
          }}
        />

        {/* address bar + search */}
        <div className="flex items-center gap-2 p-3">
          <button type="button" aria-label={`Up to ${ROOT}`} title={`Up to ${ROOT}`} disabled={!openFolder} onClick={goRoot} className={cn(cmdBtn, "w-9 justify-center px-0")}>
            <ArrowUp size={16} />
          </button>
          <nav aria-label="Location" className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 dark:border-white/20 dark:bg-white/5 dark:text-white">
            <FolderIcon size={16} />
            {openFolder ? (
              <>
                <button type="button" onClick={goRoot} className={cn("rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-white/10", focusRing)}>{ROOT}</button>
                <ChevronRight size={14} className="shrink-0 text-slate-400 dark:text-white/50" />
                <span aria-current="page" className="truncate px-1.5 font-medium">{LABELS[openFolder]}</span>
              </>
            ) : (
              <span aria-current="page" className="truncate px-1.5 font-medium">{ROOT}</span>
            )}
            <button type="button" aria-label="Refresh" title="Refresh" onClick={() => void batches.refetch()} className={cn("ml-auto rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10", focusRing)}>
              <RotateCw size={14} className={batches.isFetching ? "animate-spin" : ""} />
            </button>
          </nav>
          <div className="flex h-10 w-40 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 transition focus-within:border-[#2c317b] focus-within:ring-4 focus-within:ring-[#2c317b]/15 dark:border-white/20 dark:bg-white/5 dark:focus-within:border-[#f3ad1c] dark:focus-within:ring-[#f3ad1c]/20 sm:w-72 lg:w-96">
            <Search size={15} className="shrink-0 text-slate-500 dark:text-white/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${title}`}
              placeholder={`Search ${title}`}
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-white/50"
            />
          </div>
        </div>

        {/* command bar */}
        <div className="flex items-center gap-1 border-y border-slate-200 px-3 py-1.5 dark:border-white/10">
          {uploadTarget ? (
            <button type="button" title={`Upload to ${LABELS[uploadTarget]}`} aria-label="Upload" disabled={upload.isPending} onClick={() => startUpload(uploadTarget)} className={cmdBtn}>
              <Upload size={16} className="text-[#2c317b] dark:text-[#f3ad1c]" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          ) : (
            <Dropdown label="Upload" icon={<Upload size={16} className="text-[#2c317b] dark:text-[#f3ad1c]" />}>
              {ORDER.map((ds) => (
                <MenuItem key={ds} onClick={() => startUpload(ds)}>{LABELS[ds]}</MenuItem>
              ))}
            </Dropdown>
          )}

          <button type="button" aria-label="Open" title="View file" disabled={!selected?.batch} onClick={() => selected?.batch && setViewing(selected.batch)} className={cmdBtn}>
            <Eye size={16} />
            <span className="hidden sm:inline">Open</span>
          </button>

          <button type="button" aria-label="Delete" title="Delete" disabled={!selected?.batch} onClick={() => selected?.batch && setToRollback(selected.batch)} className={cmdBtn}>
            <Trash2 size={16} className="text-red-600 dark:text-red-300" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <button type="button" aria-label="Link agents" title="Link new agents to imported data" disabled={relink.isPending} onClick={() => void handleRelink()} className={cmdBtn}>
            <Link2 size={16} />
            <span className="hidden md:inline">{relink.isPending ? "Linking…" : "Link agents"}</span>
          </button>

          <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-white/15" />

          <Dropdown label="Sort" icon={<ArrowUpDown size={16} />}>
            {available.map((k) => (
              <MenuItem key={k} checked={activeKey === k} onClick={() => setSort((s) => ({ ...s, key: k }))}>{SORT_LABELS[k]}</MenuItem>
            ))}
            <div className="my-1 h-px bg-slate-200 dark:bg-white/10" />
            <MenuItem checked={sort.dir === "asc"} onClick={() => setSort((s) => ({ ...s, dir: "asc" }))}>Ascending</MenuItem>
            <MenuItem checked={sort.dir === "desc"} onClick={() => setSort((s) => ({ ...s, dir: "desc" }))}>Descending</MenuItem>
          </Dropdown>

          <Dropdown label="View" icon={<List size={16} />}>
            {VIEWS.map((v) => (
              <MenuItem key={v.id} checked={view === v.id} onClick={() => setView(v.id)}>{v.label}</MenuItem>
            ))}
          </Dropdown>
        </div>

        {upload.isPending && (
          <div role="progressbar" aria-label="Uploading" className="h-0.5 w-full overflow-hidden bg-sky-100 dark:bg-white/10">
            <div className="h-full w-1/3 animate-pulse bg-[#2c317b] dark:bg-[#f3ad1c]" />
          </div>
        )}

        {/* folder heading */}
        <div className="px-5 pb-2 pt-4">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-white/60">{plural(entries.length)}</p>
        </div>

        {/* content pane */}
        <div
          className="relative min-h-[300px] flex-1"
          onMouseDown={(e) => { if (!(e.target as HTMLElement).closest("[data-item]")) setSel(null); }}
          onDragOver={paneDragOver}
          onDragLeave={paneDragLeave}
          onDrop={paneDrop}
        >
          {batches.isLoading ? (
            <div aria-hidden className="animate-pulse space-y-2 px-4 py-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 rounded-md bg-slate-100 dark:bg-white/10" />
              ))}
            </div>
          ) : batches.isError ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <AlertCircle size={28} className="text-red-600 dark:text-red-300" />
              <p className="font-semibold text-slate-900 dark:text-white">Couldn’t load your files</p>
              <p className="max-w-md text-sm text-slate-600 dark:text-white/70">{friendlyError(batches.error).message}</p>
              <button type="button" onClick={() => void batches.refetch()} className={cn(cmdBtn, "mt-1 border border-slate-300 dark:border-white/20")}>
                <RotateCw size={14} /> Try again
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <FolderIcon size={56} />
              <p className="font-semibold text-slate-900 dark:text-white">
                {query ? "No items match your search" : openFolder ? "This folder is empty" : "Nothing here yet"}
              </p>
              {!query && openFolder && (
                <p className="text-sm text-slate-600 dark:text-white/70">Drag CSV files here, or select Upload to add your first report.</p>
              )}
            </div>
          ) : (
            body
          )}

          {dropId === "pane" && openFolder && (
            <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-[#2c317b] bg-sky-50/80 text-sm font-semibold text-[#2c317b] dark:border-[#f3ad1c] dark:bg-[#f3ad1c]/10 dark:text-[#f3ad1c]">
              Drop to upload to {LABELS[openFolder]}
            </div>
          )}
        </div>

        {/* status bar */}
        <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-2 text-xs text-slate-600 dark:border-white/10 dark:text-white/70">
          <span>{plural(entries.length)}</span>
          {selected && (
            <>
              <span className="h-3 w-px bg-slate-300 dark:bg-white/20" />
              <span>1 item selected</span>
            </>
          )}
          {upload.isPending && uploading && (
            <>
              <span className="h-3 w-px bg-slate-300 dark:bg-white/20" />
              <span className="truncate">Uploading {uploading}…</span>
            </>
          )}
        </div>
      </div>

      {/* right-click menu */}
      {ctx && (
        <div
          role="menu"
          style={{ left: Math.min(ctx.x, window.innerWidth - 216), top: Math.min(ctx.y, window.innerHeight - 140) }}
          className="fixed z-50 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/15 dark:bg-[#1d2170]"
          onContextMenu={(e) => e.preventDefault()}
        >
          {ctx.entry.kind === "folder" ? (
            <>
              <MenuItem onClick={() => { openDataset(ctx.entry.dataset); setCtx(null); }}>Open</MenuItem>
              <MenuItem onClick={() => { startUpload(ctx.entry.dataset); setCtx(null); }}>Upload files here</MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={() => { if (ctx.entry.batch) setViewing(ctx.entry.batch); setCtx(null); }}>Open</MenuItem>
              <MenuItem danger onClick={() => { if (ctx.entry.batch) setToRollback(ctx.entry.batch); setCtx(null); }}>
                Delete
              </MenuItem>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={toRollback !== null}
        title="Delete this file?"
        message={toRollback ? `“${toRollback.filename}” and its ${toRollback.rows_imported} imported rows will be removed. You can upload the file again afterwards.` : ""}
        loading={remove.isPending}
        onConfirm={() => void confirmRollback()}
        onCancel={() => setToRollback(null)}
      />

      {viewing && <FileViewer batch={viewing} file={filesRef.current.get(viewing.id)} onClose={() => setViewing(null)} />}
    </div>
  );
}
