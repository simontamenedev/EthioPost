"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useFsps } from "../../../../lib/hooks/use-fsps";

/* ───────────────────────────── constants & types ───────────────────────────── */

/** Inside each provider, each dataset is a folder. */
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

/** fsp = provider folder (Telebirr, CBE…), folder = dataset folder, file = one imported CSV. */
type Entry = {
  id: string;
  kind: "fsp" | "folder" | "file";
  name: string;
  fspId: string;
  dataset?: DatasetKey;
  modified: string | null;
  count: number;
  batch?: ImportBatch;
};

type Problem = { title: string; message: string };

/** What POST /imports/relink returns: { linked: {dataset: n}, created: {districts, branches, agents} }. */
type RelinkResult = {
  linked?: Record<string, number>;
  created?: { districts?: number; branches?: number; agents?: number };
};

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

/** Builds the "Link agents" toast. Reads the new nested response and the old flat one. */
function summarizeRelink(raw: unknown): { linkedTotal: number; createdTotal: number; description: string } {
  const res = (raw ?? {}) as RelinkResult & Record<string, unknown>;
  const linkedMap = (res.linked ?? res) as Record<string, unknown>;
  const linked = Object.entries(linkedMap).filter((entry): entry is [string, number] => typeof entry[1] === "number");
  const linkedTotal = linked.reduce((sum, [, n]) => sum + n, 0);

  const c = res.created ?? {};
  const noun = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
  const createdParts = [
    c.agents ? noun(c.agents, "agent", "agents") : null,
    c.branches ? noun(c.branches, "branch", "branches") : null,
    c.districts ? noun(c.districts, "district", "districts") : null,
  ].filter(Boolean) as string[];
  const createdTotal = (c.agents ?? 0) + (c.branches ?? 0) + (c.districts ?? 0);

  const parts: string[] = [];
  if (linkedTotal > 0) {
    const byDataset = linked
      .filter(([, n]) => n > 0)
      .map(([key, n]) => `${LABELS[key as DatasetKey] ?? key} ${n.toLocaleString()}`)
      .join(" · ");
    parts.push(`Linked ${noun(linkedTotal, "row", "rows")} to agents (${byDataset}).`);
  }
  if (createdParts.length) {
    const list =
      createdParts.length > 1
        ? `${createdParts.slice(0, -1).join(", ")} and ${createdParts[createdParts.length - 1]}`
        : createdParts[0];
    parts.push(`Created ${list} from the imported data. Review the new agent names in Agents.`);
  }
  return { linkedTotal, createdTotal, description: parts.join(" ") };
}

/** Saves a blob to the user's computer. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function latest(batches: ImportBatch[]): string | null {
  return batches.reduce<string | null>((m, b) => (!m || b.created_at > m ? b.created_at : m), null);
}

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
const EntryIcon = ({ e, size }: { e: Entry; size: number }) => (e.kind === "file" ? <FileIcon size={size} /> : <FolderIcon size={size} />);

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

/** Used for provider folders and dataset folders. */
const FOLDER_COLS: Col[] = [
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

export function ImportsView() {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<{ fsp: string; ds: DatasetKey } | null>(null);

  // explorer state: Documents → provider (openFsp) → dataset folder (openFolder) → files
  const [openFsp, setOpenFsp] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<DatasetKey | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState<View>("details");
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });
  const [query, setQuery] = useState("");
  const [dropId, setDropId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; entry: Entry } | null>(null);

  // upload / delete state
  const [uploading, setUploading] = useState<string | null>(null);
  const [formError, setFormError] = useState<Problem | null>(null);
  const [toRollback, setToRollback] = useState<ImportBatch | null>(null);
  const filesRef = useRef(new Map<string, File>()); // uploaded files kept for download this session

  const batches = useImports();
  const fspQuery = useFsps();
  const upload = useUploadCsv();
  const remove = useDeleteImport();
  const relink = useRelinkAgents();
  const last = upload.data;

  const fsps = useMemo(() => fspQuery.data ?? [], [fspQuery.data]);
  const fspName = (id: string) => fsps.find((f) => f.id === id)?.name ?? "Provider";

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
    if (openFsp && openFolder) {
      // level 2: the files of one dataset folder
      list = all
        .filter((b) => b.fsp_id === openFsp && b.dataset === openFolder)
        .map((b) => ({
          id: b.id, kind: "file", name: b.filename, fspId: openFsp,
          dataset: b.dataset, modified: b.created_at, count: 1, batch: b,
        }));
    } else if (openFsp) {
      // level 1: the dataset folders of one provider
      list = ORDER.map((ds) => {
        const files = all.filter((b) => b.fsp_id === openFsp && b.dataset === ds);
        return {
          id: `folder:${ds}`, kind: "folder", name: LABELS[ds], fspId: openFsp,
          dataset: ds, modified: latest(files), count: files.length,
        };
      });
    } else {
      // level 0: provider folders (Telebirr, CBE…)
      list = fsps.map((f) => {
        const files = all.filter((b) => b.fsp_id === f.id);
        return { id: `fsp:${f.id}`, kind: "fsp", name: f.name, fspId: f.id, modified: latest(files), count: files.length };
      });
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => compareEntries(a, b, { key: activeKey, dir: sort.dir }));
  }, [all, fsps, openFsp, openFolder, query, activeKey, sort.dir]);

  const selected = entries.find((e) => e.id === sel) ?? null;
  const uploadTarget: DatasetKey | null = openFsp
    ? openFolder ?? (selected?.kind === "folder" ? selected.dataset ?? null : null)
    : null;

  /* ── navigation ── */
  function openEntry(e: Entry) {
    if (e.kind === "fsp") {
      setOpenFsp(e.fspId);
      setOpenFolder(null);
    } else if (e.kind === "folder" && e.dataset) {
      setOpenFolder(e.dataset);
    }
    setSel(null);
    setQuery("");
  }
  function goUp() {
    if (openFolder) setOpenFolder(null);
    else setOpenFsp(null);
    setSel(null);
    setQuery("");
  }
  function goRoot() {
    setOpenFsp(null);
    setOpenFolder(null);
    setSel(null);
    setQuery("");
  }
  function goFsp() {
    setOpenFolder(null);
    setSel(null);
    setQuery("");
  }
  function toggleSort(key: SortKey) {
    setSort((s) => (activeKey === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "modified" ? "desc" : "asc" }));
  }

  /* ── upload (same validation + mutation as before, now per provider + folder) ── */
  function startUpload(fsp: string, ds: DatasetKey) {
    targetRef.current = { fsp, ds };
    inputRef.current?.click();
  }

  async function uploadFiles(fspId: string, ds: DatasetKey, files: File[]) {
    setFormError(null);
    for (const f of files) {
      if (!/\.csv$/i.test(f.name)) {
        setFormError({ title: "Unsupported file type", message: `“${f.name}” is not a .csv file. Only CSV reports exported from the agent monitoring system are accepted.` });
        return;
      }
      const parsed = uploadSchema.safeParse({ fsp_id: fspId, dataset: ds, file: f });
      if (!parsed.success) {
        setFormError({ title: "Check your upload", message: parsed.error.issues[0].message });
        return;
      }
      setUploading(f.name);
      try {
        const batch = await upload.mutateAsync(parsed.data);
        toast.success("Import complete", { description: `${batch.rows_imported.toLocaleString()} rows imported from ${batch.filename} (${fspName(fspId)}).` });
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

  /* ── download ── */
  async function downloadBatch(b: ImportBatch) {
    try {
      // Files uploaded in this session are cached; otherwise ask the API for the stored copy.
      const blob: Blob = filesRef.current.get(b.id) ?? (await apiDownload(`/imports/${b.id}/file`)).blob;
      saveBlob(blob, b.filename);
      toast.success("Download started", { description: b.filename });
    } catch (error) {
      const missing = error instanceof ApiError && (error.status === 404 || error.status === 405);
      toast.error("Couldn't download the file", {
        description: missing
          ? "The original file isn't stored on the server (it was uploaded before file storage was added). Upload it again to get a copy."
          : friendlyError(error).message,
      });
    }
  }

  /* ── delete (roll back) / relink ── */
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
    if (!openFsp) return;
    try {
      const res = await relink.mutateAsync(openFsp);
      const { linkedTotal, createdTotal, description } = summarizeRelink(res);

      if (createdTotal > 0) {
        // new districts / branches / agents now exist: refresh those screens
        for (const key of ["districts", "branches", "agents"]) void queryClient.invalidateQueries({ queryKey: [key] });
      }

      if (linkedTotal === 0 && createdTotal === 0) {
        toast.info("Nothing to link", { description: `Every ${fspName(openFsp)} row is already linked to an agent, and no new agents were needed.` });
      } else {
        toast.success("Agents linked", { description, duration: 8000 });
      }
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
    } else if (ev.key === "Enter" && selected && selected.kind !== "file") {
      openEntry(selected);
    } else if (ev.key === "Enter" && selected?.batch) {
      void downloadBatch(selected.batch);
    } else if ((ev.key === "Backspace" || (ev.altKey && ev.key === "ArrowUp")) && openFsp) {
      ev.preventDefault();
      goUp();
    } else if (ev.key === "Escape") {
      setSel(null);
    }
  }

  function paneDragOver(ev: React.DragEvent) {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    if (openFsp && openFolder) setDropId("pane");
  }
  function paneDragLeave(ev: React.DragEvent) {
    if (!ev.currentTarget.contains(ev.relatedTarget as Node | null)) setDropId(null);
  }
  function paneDrop(ev: React.DragEvent) {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    setDropId(null);
    const files = Array.from(ev.dataTransfer.files);
    if (openFsp && openFolder) void uploadFiles(openFsp, openFolder, files);
    else if (openFsp)
      toast.info("Drop onto a folder", { description: "Drag the file onto Transactions, Customer Registration or Customer Upgradation." });
    else toast.info("Open a provider first", { description: "Open a provider folder, then drop the file onto a dataset folder." });
  }

  /* ── per-item behaviour shared by every view ── */
  function itemProps(e: Entry) {
    return {
      "data-item": "",
      "aria-selected": sel === e.id,
      tabIndex: 0,
      onClick: () => setSel(e.id),
      onDoubleClick: () => { if (e.kind !== "file") openEntry(e); else if (e.batch) void downloadBatch(e.batch); },
      onContextMenu: (ev: React.MouseEvent) => {
        ev.preventDefault();
        setSel(e.id);
        setCtx({ x: ev.clientX, y: ev.clientY, entry: e });
      },
      ...(e.kind === "folder" && e.dataset
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
              void uploadFiles(e.fspId, e.dataset as DatasetKey, Array.from(ev.dataTransfer.files));
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
    e.kind !== "file" ? plural(e.count) : e.batch ? `${e.batch.rows_imported.toLocaleString()} rows · ${periodText(e.batch)}` : "";

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
  const cols = openFolder ? FILE_COLS : FOLDER_COLS;
  const title = openFolder ? LABELS[openFolder] : openFsp ? fspName(openFsp) : ROOT;
  const loading = batches.isLoading || fspQuery.isLoading;
  const loadError = batches.isError ? batches.error : fspQuery.isError ? fspQuery.error : null;

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
            <p className="truncate text-xs text-slate-500 dark:text-white/60">{e.kind === "file" ? "CSV file" : "File folder"}</p>
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
        <p className={cn(pageDescription, "dark:text-white/70")}>Open a provider, then a folder, and upload the agent monitoring CSV reports. Re-uploading overlapping files never creates duplicates.</p>
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
              <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-white/70">
                {fspName(last.fsp_id)} · {last.filename}
              </p>
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
                These agents are not in Agents master data yet. Open {fspName(last.fsp_id)} and select “Link agents” to create them (with their district and branch) and link the imported rows, or add them yourself first.
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
            const t = targetRef.current;
            if (files.length && t) void uploadFiles(t.fsp, t.ds, files);
          }}
        />

        {/* address bar + search */}
        <div className="flex items-center gap-2 p-3">
          <button type="button" aria-label="Up one level" title="Up one level" disabled={!openFsp} onClick={goUp} className={cn(cmdBtn, "w-9 justify-center px-0")}>
            <ArrowUp size={16} />
          </button>
          <nav aria-label="Location" className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 dark:border-white/20 dark:bg-white/5 dark:text-white">
            <FolderIcon size={16} />
            {openFsp ? (
              <>
                <button type="button" onClick={goRoot} className={cn("rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-white/10", focusRing)}>{ROOT}</button>
                <ChevronRight size={14} className="shrink-0 text-slate-400 dark:text-white/50" />
                {openFolder ? (
                  <>
                    <button type="button" onClick={goFsp} className={cn("truncate rounded px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-white/10", focusRing)}>{fspName(openFsp)}</button>
                    <ChevronRight size={14} className="shrink-0 text-slate-400 dark:text-white/50" />
                    <span aria-current="page" className="truncate px-1.5 font-medium">{LABELS[openFolder]}</span>
                  </>
                ) : (
                  <span aria-current="page" className="truncate px-1.5 font-medium">{fspName(openFsp)}</span>
                )}
              </>
            ) : (
              <span aria-current="page" className="truncate px-1.5 font-medium">{ROOT}</span>
            )}
            <button
              type="button"
              aria-label="Refresh"
              title="Refresh"
              onClick={() => { void batches.refetch(); void fspQuery.refetch(); }}
              className={cn("ml-auto rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10", focusRing)}
            >
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
          {!openFsp ? (
            <button type="button" title="Open a provider first" aria-label="Upload" disabled className={cmdBtn}>
              <Upload size={16} className="text-[#2c317b] dark:text-[#f3ad1c]" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          ) : uploadTarget ? (
            <button type="button" title={`Upload to ${fspName(openFsp)} / ${LABELS[uploadTarget]}`} aria-label="Upload" disabled={upload.isPending} onClick={() => startUpload(openFsp, uploadTarget)} className={cmdBtn}>
              <Upload size={16} className="text-[#2c317b] dark:text-[#f3ad1c]" />
              <span className="hidden sm:inline">Upload</span>
            </button>
          ) : (
            <Dropdown label="Upload" icon={<Upload size={16} className="text-[#2c317b] dark:text-[#f3ad1c]" />}>
              {ORDER.map((ds) => (
                <MenuItem key={ds} onClick={() => startUpload(openFsp, ds)}>{LABELS[ds]}</MenuItem>
              ))}
            </Dropdown>
          )}

          <button type="button" aria-label="Download" title="Download file" disabled={!selected?.batch} onClick={() => selected?.batch && void downloadBatch(selected.batch)} className={cmdBtn}>
            <Download size={16} />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button type="button" aria-label="Delete" title="Delete" disabled={!selected?.batch} onClick={() => selected?.batch && setToRollback(selected.batch)} className={cmdBtn}>
            <Trash2 size={16} className="text-red-600 dark:text-red-300" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          <button
            type="button"
            aria-label="Link agents"
            title={openFsp ? `Create missing agents, branches and districts for ${fspName(openFsp)}, then link its imported rows to agents` : "Open a provider first"}
            disabled={!openFsp || relink.isPending}
            onClick={() => void handleRelink()}
            className={cmdBtn}
          >
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
          {loading ? (
            <div aria-hidden className="animate-pulse space-y-2 px-4 py-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 rounded-md bg-slate-100 dark:bg-white/10" />
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <AlertCircle size={28} className="text-red-600 dark:text-red-300" />
              <p className="font-semibold text-slate-900 dark:text-white">Couldn’t load your files</p>
              <p className="max-w-md text-sm text-slate-600 dark:text-white/70">{friendlyError(loadError).message}</p>
              <button type="button" onClick={() => { void batches.refetch(); void fspQuery.refetch(); }} className={cn(cmdBtn, "mt-1 border border-slate-300 dark:border-white/20")}>
                <RotateCw size={14} /> Try again
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <FolderIcon size={56} />
              <p className="font-semibold text-slate-900 dark:text-white">
                {query
                  ? "No items match your search"
                  : openFolder
                    ? "This folder is empty"
                    : openFsp
                      ? "Nothing here yet"
                      : "No service providers yet"}
              </p>
              {!query && openFolder && (
                <p className="text-sm text-slate-600 dark:text-white/70">Drag CSV files here, or select Upload to add your first report.</p>
              )}
              {!query && !openFsp && (
                <p className="text-sm text-slate-600 dark:text-white/70">Add a service provider (for example Telebirr or CBE) first, then upload its reports here.</p>
              )}
            </div>
          ) : (
            body
          )}

          {dropId === "pane" && openFsp && openFolder && (
            <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-[#2c317b] bg-sky-50/80 text-sm font-semibold text-[#2c317b] dark:border-[#f3ad1c] dark:bg-[#f3ad1c]/10 dark:text-[#f3ad1c]">
              Drop to upload to {fspName(openFsp)} / {LABELS[openFolder]}
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
          {ctx.entry.kind === "fsp" && (
            <MenuItem onClick={() => { openEntry(ctx.entry); setCtx(null); }}>Open</MenuItem>
          )}
          {ctx.entry.kind === "folder" && ctx.entry.dataset && (
            <>
              <MenuItem onClick={() => { openEntry(ctx.entry); setCtx(null); }}>Open</MenuItem>
              <MenuItem onClick={() => { startUpload(ctx.entry.fspId, ctx.entry.dataset as DatasetKey); setCtx(null); }}>Upload files here</MenuItem>
            </>
          )}
          {ctx.entry.kind === "file" && (
            <>
              <MenuItem onClick={() => { if (ctx.entry.batch) void downloadBatch(ctx.entry.batch); setCtx(null); }}>Download</MenuItem>
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
    </div>
  );
}
