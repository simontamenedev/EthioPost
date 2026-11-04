import { keepPreviousData, useQuery } from "@tanstack/react-query";


import type {
  AnalyticsFilters, BreakdownRow, DatasetKey, FilterOptions, Overview, Page, SeriesPoint,
  Transaction, Registration, Upgrade,
} from "../../../../lib/api/analytics-types";
import { api, API_URL, ApiError } from "../../../../lib/api/client";
import { useAuthStore } from "../../../../lib/auth/auth-store";
import { LOGIN_PATH } from "../../../../lib/auth/constants";

/** Drop empty values so query keys are stable and `?region=` is never sent. */
const clean = (f: object) =>
  Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

export const analyticsKeys = {
  all: ["analytics"] as const,
  overview: (f: AnalyticsFilters) => ["analytics", "overview", clean(f)] as const,
  series: (d: DatasetKey, f: AnalyticsFilters, extra: object) =>
    ["analytics", d, "series", clean(f), clean(extra)] as const,
  breakdown: (d: DatasetKey, f: AnalyticsFilters, extra: object) =>
    ["analytics", d, "breakdown", clean(f), clean(extra)] as const,
  rows: (d: DatasetKey, f: AnalyticsFilters, extra: object) =>
    ["analytics", d, "rows", clean(f), clean(extra)] as const,
  options: ["analytics", "filters"] as const,
};

export function useOverview(filters: AnalyticsFilters) {
  return useQuery<Overview, ApiError>({
    queryKey: analyticsKeys.overview(filters),
    queryFn: ({ signal }) =>
      api<Overview>("/analytics/overview", { query: filters, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useTimeseries(
  dataset: DatasetKey,
  filters: AnalyticsFilters,
  opts: { interval?: "day" | "week" | "month"; group_by?: string } = {},
) {
  return useQuery<SeriesPoint[], ApiError>({
    queryKey: analyticsKeys.series(dataset, filters, opts),
    queryFn: ({ signal }) =>
      api<SeriesPoint[]>(`/analytics/${dataset}/timeseries`, {
        query: { ...filters, ...opts },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useBreakdown(
  dataset: DatasetKey,
  filters: AnalyticsFilters,
  opts: { dimension?: string; limit?: number } = {},
) {
  return useQuery<BreakdownRow[], ApiError>({
    queryKey: analyticsKeys.breakdown(dataset, filters, opts),
    queryFn: ({ signal }) =>
      api<BreakdownRow[]>(`/analytics/${dataset}/breakdown`, {
        query: { ...filters, ...opts },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

type RowsByDataset = { transactions: Transaction; registrations: Registration; upgrades: Upgrade };

/** Paged, sortable, filterable raw rows for the data tables. */
export function useRows<D extends DatasetKey>(
  dataset: D,
  filters: AnalyticsFilters,
  paging: { skip?: number; limit?: number; sort?: string; order?: "asc" | "desc" } = {},
) {
  return useQuery<Page<RowsByDataset[D]>, ApiError>({
    queryKey: analyticsKeys.rows(dataset, filters, paging),
    queryFn: ({ signal }) =>
      api<Page<RowsByDataset[D]>>(`/data/${dataset}`, {
        query: { ...filters, ...paging },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useFilterOptions() {
  return useQuery<FilterOptions, ApiError>({
    queryKey: analyticsKeys.options,
    queryFn: ({ signal }) => api<FilterOptions>("/analytics/filters", { signal }),
    staleTime: 5 * 60_000,
  });
}

/** Authenticated CSV download (a plain <a href> would not carry the bearer token). */
export async function downloadCsv(
  path: string,
  filters: AnalyticsFilters,
  extra: Record<string, unknown> = {},
) {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries({ ...clean(filters), ...clean(extra) })) {
    url.searchParams.set(key, String(value));
  }

  const token = useAuthStore.getState().token;
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    if (typeof window !== "undefined" && window.location.pathname !== LOGIN_PATH) {
      window.location.assign(LOGIN_PATH);
    }
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText || "Export failed");

  const name =
    /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
    "export.csv";
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: blobUrl, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

export const exportRows = (d: DatasetKey, f: AnalyticsFilters) =>
  downloadCsv(`/data/${d}/export`, f);
export const exportBreakdown = (d: DatasetKey, f: AnalyticsFilters, dimension: string) =>
  downloadCsv(`/analytics/${d}/breakdown/export`, f, { dimension });