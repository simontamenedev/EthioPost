import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "../../../../lib/api/types";
import type { AnalyticsFilters, DashboardOverview } from "../../../../lib/api/analytics-types";
import { api, ApiError } from "../../../../lib/api/client";

export const dashboardKeys = { stats: ["dashboard", "stats"] as const };

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: dashboardKeys.stats,
    queryFn: ({ signal }) => api<DashboardStats>("/dashboard/stats", { signal }),
    staleTime: 30_000,
  });
}

export function useDashboardOverview(
  range: Pick<AnalyticsFilters, "date_from" | "date_to">,
  top = 10,
) {
  return useQuery<DashboardOverview, ApiError>({
    queryKey: ["dashboard", "overview", range, top],
    queryFn: ({ signal }) =>
      api<DashboardOverview>("/dashboard/overview", { query: { ...range, top }, signal }),
    placeholderData: keepPreviousData,
  });
}