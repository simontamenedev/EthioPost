import { useQuery } from "@tanstack/react-query";
import { DashboardStats } from "../../../../lib/api/types";
import { api } from "../../../../lib/api/client";

export const dashboardKeys = { stats: ["dashboard", "stats"] as const };

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: dashboardKeys.stats,
    queryFn: ({ signal }) => api<DashboardStats>("/dashboard/stats", { signal }),
    staleTime: 30_000,
  });
}