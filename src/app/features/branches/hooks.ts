import { useMemo } from "react";
import { Branch, BranchPayload } from "../../../lib/api/types";
import { createCrudHooks } from "../../../lib/api/crud-hooks";
;

const branches = createCrudHooks<Branch, BranchPayload, Partial<BranchPayload>, { district_id?: string }>("branches");

export const branchKeys = branches.keys;
export const useBranches = branches.useList;
export const useBranch = branches.useOne;
export const useCreateBranch = branches.useCreate;
export const useUpdateBranch = branches.useUpdate;
export const useDeleteBranch = branches.useDelete;

export function useBranchLookup() {
  const query = useBranches({ limit: 200 });
  return useMemo(() => {
    const rows = query.data ?? [];
    return {
      isLoading: query.isLoading,
      rows,
      nameOf: (id: string) => rows.find((b) => b.id === id)?.name ?? "—",
    };
  }, [query.data, query.isLoading]);
}
