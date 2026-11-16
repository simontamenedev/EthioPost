"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "../../../../components/ui/badge";
import type { Column } from "../../../../components/ui/data-table";
import type { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import type {
  ServiceTypeTarget,
  ServiceTypeTargetPayload,
  ServiceTypeTargetUpdatePayload,
} from "../../../../lib/api/types";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { formatDate } from "../../../../lib/utils";
import { useServiceTypes } from "../../service-types/hooks"; // adjust path to your service-types hooks
import { useCreateTarget, useDeleteTarget, useTargets, useUpdateTarget } from "../hooks";
import { targetSchema, type TargetFormValues } from "../schema";
import { DistrictAllocationEditor } from "./districtAllocationEditor";

import { TargetDetailPanel } from "./target-detail";

const toPayload = (v: TargetFormValues): ServiceTypeTargetPayload => ({
  name: v.name || null,
  year: v.year,
  target_value: v.target_value,
  service_type_ids: v.service_type_ids,
  status: v.status,
});

// The year is fixed after creation, so it is left out of updates.
const toUpdatePayload = (v: TargetFormValues): ServiceTypeTargetUpdatePayload => {
  const { year: _year, ...rest } = toPayload(v);
  return rest;
};

const num = (v: string | number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
const label = (r: ServiceTypeTarget) => r.name || r.service_types.map((s) => s.name).join(" + ");

export function TargetsView() {
  const create = useCreateTarget();
  const update = useUpdateTarget();
  const remove = useDeleteTarget();
  const serviceTypes = useServiceTypes({ limit: 200 });
  const isAdmin = useIsAdmin();
  const [splitting, setSplitting] = useState<ServiceTypeTarget | null>(null);

  const serviceTypeOptions = useMemo(
    () => (serviceTypes.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    [serviceTypes.data],
  );

  const columns = useMemo<Column<ServiceTypeTarget>[]>(
    () => [
      {
        key: "name",
        header: "Target",
        cell: (r) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{label(r)}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-white/60">
              {r.service_types.map((s) => s.name).join(", ")}
            </p>
          </div>
        ),
      },
      { key: "year", header: "Year", cell: (r) => r.year },
      { key: "target", header: "Annual target", cell: (r) => <span className="tabular-nums">{num(r.target_value)}</span> },
      {
        key: "allocated",
        header: "Districts",
        cell: (r) => (
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{Number(r.allocated_percent).toFixed(1)}%</span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setSplitting(r)}
                className="text-xs font-semibold text-[#2c317b] hover:underline dark:text-white"
              >
                {Number(r.allocated_percent) > 0 ? "Edit split" : "Split"}
              </button>
            )}
          </div>
        ),
      },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      { key: "updated", header: "Updated", cell: (r) => formatDate(r.updated_at) },
    ],
    [isAdmin],
  );

  // "number" and "multiselect" are field types added to EntityForm (see entity-form.tsx).
  const fields = useMemo<FieldConfig<TargetFormValues>[]>(
    () => [
      { name: "name", label: "Name", placeholder: "e.g. Cash In + Cash Out" },
      // Year is set on creation only (hidden when editing), because it is fixed afterwards.
      { name: "year", label: "Year", type: "number", placeholder: "e.g. 2026", modes: ["create"] },
      { name: "target_value", label: "Annual target", type: "number", placeholder: "Transaction count or amount" },
      {
        name: "service_type_ids",
        label: "Service types",
        type: "multiselect",
        options: serviceTypeOptions,
        hint: "A service type can be in only one target per year.",
      },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
    ],
    [serviceTypeOptions],
  );

  return (
    <>
    <ResourceManager<ServiceTypeTarget, TargetFormValues, ServiceTypeTargetPayload, ServiceTypeTargetUpdatePayload>
      title="Annual targets"
      description="Yearly targets per service type, split across districts."
      singular="target"
      searchPlaceholder="Search targets…"
      columns={columns}
      useList={useTargets}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={targetSchema}
      fields={fields}
      emptyValues={{
        name: "",
        year: new Date().getFullYear(),
        target_value: 0,
        service_type_ids: [],
        status: "active",
      }}
      toFormValues={(r) => ({
        name: r.name ?? "",
        year: r.year,
        target_value: Number(r.target_value),
        service_type_ids: r.service_types.map((s) => s.id),
        status: r.status,
      })}
      toCreatePayload={toPayload}
      toUpdatePayload={toUpdatePayload}
      rowLabel={label}
      modalSize="md"
      renderDetail={(row, close) => <TargetDetailPanel key={row.id} id={row.id} onClose={close} />}
    />
    {splitting && <DistrictAllocationEditor target={splitting} open onClose={() => setSplitting(null)} />}
    </>
  );
}