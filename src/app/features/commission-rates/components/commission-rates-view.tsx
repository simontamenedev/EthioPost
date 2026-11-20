"use client";

import { useMemo } from "react";
import { Badge, StatusBadge } from "../../../../components/ui/badge";
import type { Column } from "../../../../components/ui/data-table";
import type { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import type { CommissionRate, CommissionRatePayload } from "../../../../lib/api/types";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { formatDate } from "../../../../lib/utils";
import { useServiceTypes } from "../../service-types/hooks";
import { useCommissionRates, useCreateCommissionRate, useDeleteCommissionRate, useUpdateCommissionRate } from "../hooks";
import { commissionRateSchema, type CommissionRateFormValues } from "../schema";

const toPayload = (v: CommissionRateFormValues): CommissionRatePayload => ({
  service_name: v.service_name,
  rate: Number(v.rate),
  service_type_ids: v.service_type_ids,
  remark: v.remark || null,
  status: v.status,
});

export function CommissionRatesView() {
  const create = useCreateCommissionRate();
  const update = useUpdateCommissionRate();
  const remove = useDeleteCommissionRate();
  const serviceTypes = useServiceTypes({ limit: 200 });

  const serviceTypeOptions = useMemo(
    () => (serviceTypes.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    [serviceTypes.data],
  );

  const columns = useMemo<Column<CommissionRate>[]>(
    () => [
      {
        key: "types",
        header: "Applies to",
        cell: (r) => (
          <div>
            {r.service_types.length ? (
              <div className="flex flex-wrap gap-1">
                {r.service_types.map((t) => (
                  <Badge key={t.id} tone="blue">{t.name}</Badge>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 dark:text-white/40">Not mapped</span>
            )}
            {r.remark && (
              <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-white/60">{r.remark}</p>
            )}
          </div>
        ),
      },
      {
        key: "rate",
        header: "Agent commission",
        cell: (r) => <span className="font-semibold tabular-nums">{Number(r.rate)}%</span>,
      },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      { key: "updated", header: "Updated", cell: (r) => formatDate(r.updated_at) },
    ],
    [],
  );

  const fields = useMemo<FieldConfig<CommissionRateFormValues>[]>(
    () => [
      { name: "service_name", label: "Product / service", placeholder: "e.g. Cash-In / Cash-Out Services" },
      {
        name: "rate",
        label: "Agent commission (%)",
        placeholder: "e.g. 50",
        hint: "Share of the FSP commission pool paid to the agent.",
      },
      {
        name: "service_type_ids",
        label: "Service types",
        type: "multiselect",
        options: serviceTypeOptions,
        hint: "Imports for these service types use this rate. A service type can be in only one rate. Changing the rate only affects future imports.",
      },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
      { name: "remark", label: "Remark", type: "textarea", placeholder: "Optional notes" },
    ],
    [serviceTypeOptions],
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
      emptyValues={{ service_name: "", rate: "", service_type_ids: [], remark: "", status: "active" }}
      toFormValues={(r) => ({
        service_name: r.service_name,
        rate: String(Number(r.rate)),
        service_type_ids: r.service_types.map((s) => s.id),
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