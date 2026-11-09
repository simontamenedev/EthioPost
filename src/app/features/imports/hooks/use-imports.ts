import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { analyticsKeys } from "../../analytics/hooks/use-analytics";
import type { DatasetKey, ImportBatch } from "../../../../lib/api/analytics-types";
import { api, ApiError } from "../../../../lib/api/client";

const KEY = ["imports"] as const;

/** What POST /imports/relink returns. */
export type RelinkResponse = {
  linked: Record<DatasetKey, number>;
  created: { districts: number; branches: number; agents: number };
};

export function useImports(opts: { dataset?: DatasetKey; fspId?: string } = {}) {
  const { dataset, fspId } = opts;
  return useQuery<ImportBatch[], ApiError>({
    queryKey: [...KEY, fspId ?? "all", dataset ?? "all"],
    queryFn: ({ signal }) =>
      api<ImportBatch[]>("/imports", {
        // the explorer groups by provider and dataset in the browser, so fetch them all
        query: { fsp_id: fspId, dataset, limit: 500 },
        signal,
      }),
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
  return useMutation<ImportBatch, ApiError, { fsp_id: string; dataset: DatasetKey; file: File }>({
    mutationFn: ({ fsp_id, dataset, file }) => {
      const formData = new FormData();
      formData.append("fsp_id", fsp_id);
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

/** Links one provider's imported rows to agents. The variable is the provider id. */
export function useRelinkAgents() {
  const refresh = useRefresh();
  return useMutation<RelinkResponse, ApiError, string>({
    mutationFn: (fspId) =>
      api<RelinkResponse>("/imports/relink", { method: "POST", query: { fsp_id: fspId } }),
    onSuccess: refresh,
  });
}