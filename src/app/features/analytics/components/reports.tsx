"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { type Column, DataTable } from "../../../../components/ui/data-table";
import { inputBase } from "../../../../components/ui/styles";
import { errorMessage } from "../../../../lib/api/client";
import { useDebouncedValue } from "../../../../lib/hooks/use-debounced-value";
import { cn } from "../../../../lib/utils";
import { DateRangeFilter } from "./date-range-filter";
import { AnalyticsFilters, DatasetKey, FilterOptions } from "../../../../lib/api/analytics-types";
import { pageDescription, pageShell, pageTitle, secondaryButton } from "../styles/styles";
import { formatInt } from "../../transactions/const/format";
import { DateRange, presetRange } from "../lib/date-range";
import { exportRows, useFilterOptions, useRows } from "../hooks/use-analytics";

const PAGE_SIZE = 20;

export type ExtraFilter = {
  param: "service_type" | "channel" | "status" | "before_level" | "after_level";
  label: string; // shown as the "All …" option
  options: (o: FilterOptions) => string[];
};

type Props<D extends DatasetKey> = {
  dataset: D;
  title: string;
  description: string;
  columns: Column<any[D]>[];
  sortField: string;
  extraFilters?: ExtraFilter[];
  searchPlaceholder?: string;
};

/** Shared list page: date range, search, region + dataset filters, paging, CSV export. */
export function ReportPage<D extends DatasetKey>({
  dataset, title, description, columns, sortField, extraFilters = [],
  searchPlaceholder = "Search by agent name or short code…",
}: Props<D>) {
  const [range, setRange] = useState<DateRange>(presetRange("last30"));
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const q = useDebouncedValue(search.trim());

  const options = useFilterOptions();
  const filters = { ...range, q: q || undefined, region: region || undefined, ...extra } as AnalyticsFilters;
  const query = useRows(dataset, filters, { skip: page * PAGE_SIZE, limit: PAGE_SIZE, sort: sortField, order: "desc" });
  const total = query.data?.total ?? 0;
  const hasFilters = !!(q || region || Object.values(extra).some(Boolean));

  async function handleExport() {
    setExporting(true);
    try {
      await exportRows(dataset, filters);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={pageShell}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className={pageTitle}>{title}</h1>
          <p className={pageDescription}>{description}</p>
        </div>
        <button type="button" onClick={() => void handleExport()} disabled={exporting || total === 0} className={cn(secondaryButton, "shrink-0")}>
          <Download size={16} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <DateRangeFilter value={range} onChange={(r) => { setRange(r); setPage(0); }} />
  <input
          aria-label={`Search ${title.toLowerCase()}`}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder={searchPlaceholder}
          className={cn(inputBase, "h-10 w-full sm:max-w-sm sm:flex-1")}
        />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      
        <select
          aria-label="Filter by region"
          value={region}
          onChange={(e) => { setRegion(e.target.value); setPage(0); }}
          className={cn(inputBase, "h-10 w-full sm:w-40")}
        >
          <option value="">All regions</option>
          {options.data?.regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {extraFilters.map((f) => (
          <select
            key={f.param}
            aria-label={`Filter by ${f.label}`}
            value={extra[f.param] ?? ""}
            onChange={(e) => { setExtra({ ...extra, [f.param]: e.target.value }); setPage(0); }}
            className={cn(inputBase, "h-10 w-full sm:w-48")}
          >
            <option value="">All {f.label}</option>
            {options.data && f.options(options.data).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <p className="text-sm text-slate-500 dark:text-white/60 sm:ml-auto">{formatInt(total)} rows</p>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        getRowId={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error?.message}
        onRetry={() => void query.refetch()}
        emptyTitle={hasFilters ? "No matches" : "No data for this period"}
        emptyHint={hasFilters ? "Try a different search or filter." : "Pick another date range, or import a CSV from Data imports."}
        page={page}
        pageSize={PAGE_SIZE}
        hasNext={(page + 1) * PAGE_SIZE < total}
        onPageChange={setPage}
      />
    </div>
  );
}
