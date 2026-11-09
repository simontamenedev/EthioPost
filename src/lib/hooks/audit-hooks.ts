import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import type { AuditLog } from "../api/types";

export type AuditModel =
  | "Branch"
  | "District"
  | "Agent"
  | "FinancialServiceProvider"
  | "ServiceType"
  | "CommissionRule";

export const auditKeys = {
  all: ["audit-logs"] as const,
  record: (model: AuditModel, id: string) => ["audit-logs", model, id] as const,
};

/** Change history of one record. Admin-only on the API, so pass enabled={isAdmin}. */
export function useRecordAuditLogs(model: AuditModel, id: string | undefined, enabled = true) {
  return useQuery<AuditLog[], ApiError>({
    queryKey: auditKeys.record(model, id ?? ""),
    queryFn: ({ signal }) =>
      api<AuditLog[]>(`/audit-logs/${model}/${id}`, { query: { limit: 50 }, signal }),
    placeholderData: keepPreviousData,
    enabled: enabled && Boolean(id),
  });
}