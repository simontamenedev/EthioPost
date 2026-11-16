import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../../lib/api/client";
import { createCrudHooks } from "../../../lib/api/crud-hooks";
import type {
  DistrictAllocationPayload,
  DistrictAllocationRow,
  ServiceTypeTarget,
  ServiceTypeTargetDetail,
  ServiceTypeTargetFilters,
  ServiceTypeTargetPayload,
  ServiceTypeTargetUpdatePayload,
} from "../../../lib/api/types";
import type { MonthAllocationPayload, MonthAllocationResponse } from "../../../lib/api/types";
const targets = createCrudHooks<
  ServiceTypeTarget,
  ServiceTypeTargetPayload,
  ServiceTypeTargetUpdatePayload,
  ServiceTypeTargetFilters,
  ServiceTypeTargetDetail
>("service-type-targets");

export const targetKeys = targets.keys;
export const useTargets = targets.useList;
export const useTarget = targets.useOne;
export const useCreateTarget = targets.useCreate;
export const useUpdateTarget = targets.useUpdate;
export const useDeleteTarget = targets.useDelete;

/** Every active district with its current share, for the allocation editor. */
export function useTargetDistricts(id: string | undefined, enabled = true) {
  return useQuery<DistrictAllocationRow[], ApiError>({
    // Starts with the detail key, so invalidating the resource refreshes it too.
    queryKey: [...targets.keys.detail(id ?? ""), "districts"],
    queryFn: ({ signal }) => api<DistrictAllocationRow[]>(`/service-type-targets/${id}/districts`, { signal }),
    enabled: Boolean(id) && enabled,
  });
}

/** Replace the district split of one target (by value, by percent, or evenly). */
export function useSetDistrictTargets() {
  const queryClient = useQueryClient();
  return useMutation<ServiceTypeTargetDetail, ApiError, { id: string; data: DistrictAllocationPayload }>({
    mutationFn: ({ id, data }) =>
      api<ServiceTypeTargetDetail>(`/service-type-targets/${id}/districts`, { method: "PUT", json: data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      return queryClient.invalidateQueries({ queryKey: targets.keys.all });
    },
  });
}
export function useDistrictMonths(targetId: string | undefined, districtId: string | undefined, enabled = true) {
  return useQuery<MonthAllocationResponse, ApiError>({
    queryKey: [...targets.keys.detail(targetId ?? ""), "districts", districtId, "months"],
    queryFn: ({ signal }) =>
      api<MonthAllocationResponse>(`/service-type-targets/${targetId}/districts/${districtId}/months`, { signal }),
    enabled: Boolean(targetId && districtId) && enabled,
  });
}

export function useSetMonthTargets() {
  const queryClient = useQueryClient();
  return useMutation<
    ServiceTypeTargetDetail,
    ApiError,
    { id: string; districtId: string; data: MonthAllocationPayload }
  >({
    mutationFn: ({ id, districtId, data }) =>
      api<ServiceTypeTargetDetail>(`/service-type-targets/${id}/districts/${districtId}/months`, {
        method: "PUT",
        json: data,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      return queryClient.invalidateQueries({ queryKey: targets.keys.all });
    },
  });
}