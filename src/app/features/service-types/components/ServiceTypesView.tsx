"use client";

import { useMemo } from "react";
import { Badge, StatusBadge } from "../../../../components/ui/badge";
import type { Column } from "../../../../components/ui/data-table";
import type { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import type { ServiceType, ServiceTypePayload } from "../../../../lib/api/types";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { useCreateServiceType, useDeleteServiceType, useServiceTypes, useUpdateServiceType } from "../hooks";
import { serviceTypeSchema, type ServiceTypeFormValues } from "../schema";
import { ServiceTypeDetailPanel } from "./service-type-detail";

const toPayload = (v: ServiceTypeFormValues): ServiceTypePayload => ({
  code: v.code,
  name: v.name,
  csv_label: v.csv_label || null,
  description: v.description || null,
  status: v.status,
});

export function ServiceTypesView() {
  const create = useCreateServiceType();
  const update = useUpdateServiceType();
  const remove = useDeleteServiceType();

  const columns = useMemo<Column<ServiceType>[]>(
    () => [
      {
        key: "name",
        header: "Service",
        cell: (r) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
            {r.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-white/60">{r.description}</p>}
          </div>
        ),
      },
      { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
      {
        key: "csv",
        header: "CSV service type",
        cell: (r) =>
          r.csv_label ? <Badge tone="blue">{r.csv_label}</Badge> : <span className="text-slate-400 dark:text-white/40">Not in reports</span>,
      },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    ],
    [],
  );

  const fields = useMemo<FieldConfig<ServiceTypeFormValues>[]>(
    () => [
      { name: "name", label: "Name", placeholder: "e.g. Cash Out" },
      { name: "code", label: "Code", placeholder: "e.g. CASH_OUT" },
      {
        name: "csv_label",
        label: "CSV service type",
        placeholder: "Cash Out",
        hint: "Exact value in the transactions report. Leave empty for services that are not reported (agent registration, annuity…).",
      },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
      { name: "description", label: "Description", type: "textarea", placeholder: "Optional notes" },
    ],
    [],
  );

  return (
    <ResourceManager<ServiceType, ServiceTypeFormValues, ServiceTypePayload, Partial<ServiceTypePayload>>
      title="Service types"
      description="Services that can earn commission, shared by all providers."
      singular="service type"
      searchPlaceholder="Search service types…"
      columns={columns}
      useList={useServiceTypes}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={serviceTypeSchema}
      fields={fields}
      emptyValues={{ code: "", name: "", csv_label: "", description: "", status: "active" }}
      toFormValues={(r) => ({
        code: r.code, name: r.name, csv_label: r.csv_label ?? "", description: r.description ?? "", status: r.status,
      })}
      toCreatePayload={toPayload}
      toUpdatePayload={toPayload}
      rowLabel={(r) => r.name}
      modalSize="md"
      renderDetail={(row, close) => <ServiceTypeDetailPanel key={row.id} id={row.id} onClose={close} />}
    />
  );
}