import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { analyticsKeys } from "../../analytics/hooks/use-analytics";
import type { DatasetKey, ImportBatch } from "../../../../lib/api/analytics-types";
import { api, ApiError } from "../../../../lib/api/client";

const KEY = ["imports"] as const;

export function useImports(dataset?: DatasetKey) {
  return useQuery<ImportBatch[], ApiError>({
    queryKey: [...KEY, dataset ?? "all"],
    queryFn: ({ signal }) =>
      api<ImportBatch[]>("/imports", { query: { dataset, limit: 100 }, signal }),
  });
}

/** Uploading/deleting/relinking changes every dashboard number, so invalidate analytics too. */
function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: KEY }),
      qc.invalidateQueries({ queryKey: analyticsKeys.all }),
    ]);
}

export function useUploadCsv() {
  const refresh = useRefresh();
  return useMutation<ImportBatch, ApiError, { dataset: DatasetKey; file: File }>({
    mutationFn: ({ dataset, file }) => {
      const formData = new FormData();
      formData.append("dataset", dataset);
      formData.append("file", file);
      return api<ImportBatch>("/imports", { method: "POST", formData });
    },
    onSuccess: refresh,
  });
}

export function useDeleteImport() {
  const refresh = useRefresh();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api<void>(`/imports/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useRelinkAgents() {
  const refresh = useRefresh();
  return useMutation<Record<DatasetKey, number>, ApiError, void>({
    mutationFn: () =>
      api<Record<DatasetKey, number>>("/imports/relink", { method: "POST" }),
    onSuccess: refresh,
  });
}