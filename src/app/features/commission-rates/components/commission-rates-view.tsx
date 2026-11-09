"use client";

import { useMemo } from "react";
import { Badge, StatusBadge } from "../../../../components/ui/badge";
import type { Column } from "../../../../components/ui/data-table";
import type { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import type { CommissionRate, CommissionRatePayload } from "../../../../lib/api/types";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { formatDate } from "../../../../lib/utils";
import { useCommissionRates, useCreateCommissionRate, useDeleteCommissionRate, useUpdateCommissionRate } from "../hooks";
import { commissionRateSchema, type CommissionRateFormValues } from "../schema";

const toPayload = (v: CommissionRateFormValues): CommissionRatePayload => ({
  service_name: v.service_name,
  rate: Number(v.rate),
  service_types: v.service_types
    ? v.service_types.split(",").map((s) => s.trim()).filter(Boolean)
    : null,
  remark: v.remark || null,
  status: v.status,
});

export function CommissionRatesView() {
  const create = useCreateCommissionRate();
  const update = useUpdateCommissionRate();
  const remove = useDeleteCommissionRate();

  const columns = useMemo<Column<CommissionRate>[]>(
    () => [
      {
        key: "service",
        header: "Product / service",
        cell: (r) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{r.service_name}</p>
            {r.remark && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-white/60">{r.remark}</p>}
          </div>
        ),
      },
      { key: "rate", header: "Agent commission", cell: (r) => <span className="font-semibold tabular-nums">{Number(r.rate)}%</span> },
      {
        key: "types",
        header: "Applies to (CSV service types)",
        cell: (r) =>
          r.service_types?.length ? (
            <div className="flex flex-wrap gap-1">
              {r.service_types.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-white/40">Not mapped</span>
          ),
      },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      { key: "updated", header: "Updated", cell: (r) => formatDate(r.updated_at) },
    ],
    [],
  );

  const fields = useMemo<FieldConfig<CommissionRateFormValues>[]>(
    () => [
      { name: "service_name", label: "Product / service", placeholder: "e.g. Cash-In / Cash-Out Services" },
      { name: "rate", label: "Agent commission (%)", placeholder: "e.g. 50", hint: "Share of Ethiopost's gross revenue paid to the agent." },
      {
        name: "service_types",
        label: "CSV service types",
        placeholder: "Cash In, Cash Out",
        hint: "Comma-separated. Imported transactions with these service types use this rate. Changing the rate only affects future imports.",
      },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
      { name: "remark", label: "Remark", type: "textarea", placeholder: "Optional notes" },
    ],
    [],
  );

  return (
    <ResourceManager<CommissionRate, CommissionRateFormValues, CommissionRatePayload, Partial<CommissionRatePayload>>
      title="Commission rates"
      description="Agent commission percentage per DFS product or service."
      singular="commission rate"
      searchPlaceholder="Search services…"
      columns={columns}
      useList={useCommissionRates}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={commissionRateSchema}
      fields={fields}
      emptyValues={{ service_name: "", rate: "", service_types: "", remark: "", status: "active" }}
      toFormValues={(r) => ({
        service_name: r.service_name,
        rate: String(Number(r.rate)),
        service_types: (r.service_types ?? []).join(", "),
        remark: r.remark ?? "",
        status: r.status,
      })}
      toCreatePayload={toPayload}
      toUpdatePayload={toPayload}
      rowLabel={(r) => r.service_name}
      modalSize="md"
    />
  );
}