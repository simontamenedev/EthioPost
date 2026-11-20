"use client";

import { useMemo } from "react";
import { StatusBadge } from "../../../../components/ui/badge";
import type { Column } from "../../../../components/ui/data-table";
import type { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import { District, DistrictPayload } from "../../../../lib/api/types";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { formatDate } from "../../../../lib/utils";
import {
  useCreateDistrict,
  useDeleteDistrict,
  useParentDistrictOptions,
  useParentDistricts,
  useUpdateDistrict,
} from "../hooks";
import { districtSchema, type DistrictFormValues } from "../schema";
import { DistrictDetailPanel } from "./district-detail";

const columns: Column<District>[] = [
  {
    key: "name",
    header: "District",
    cell: (d) => (
      <div>
        <p className="font-semibold text-slate-900 dark:text-white">{d.name}</p>
        {d.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-white/60">{d.description}</p>}
      </div>
    ),
  },
  { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
  { key: "created", header: "Created", cell: (d) => formatDate(d.created_at) },
];

const toPayload = (v: DistrictFormValues): DistrictPayload => ({
  name: v.name,
  description: v.description || null,
  parent_id: v.parent_id || null,
  status: v.status,
});

export function DistrictsView() {
  const create = useCreateDistrict();
  const update = useUpdateDistrict();
  const remove = useDeleteDistrict();
  const parentOptions = useParentDistrictOptions();

  const fields = useMemo<FieldConfig<DistrictFormValues>[]>(
    () => [
      { name: "name", label: "Name", placeholder: "e.g. Addis Ababa District" },
      {
        name: "parent_id",
        label: "Parent district",
        type: "select",
        options: parentOptions,
        placeholder: "None (top-level district)",
        hint: "Leave empty for an Ethio Post district. Pick one to create a child (Ethio Telecom region).",
      },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
      { name: "description", label: "Description", type: "textarea", placeholder: "Optional notes" },
    ],
    [parentOptions],
  );

  return (
    <ResourceManager<District, DistrictFormValues, DistrictPayload, Partial<DistrictPayload>>
      title="Districts"
      description="Parent districts. Open one to see the child districts (regions) under it."
      singular="district"
      searchPlaceholder="Search districts…"
      columns={columns}
      useList={useParentDistricts}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={districtSchema}
      fields={fields}
      emptyValues={{ name: "", description: "", parent_id: "", status: "active" }}
      toFormValues={(d) => ({
        name: d.name,
        description: d.description ?? "",
        parent_id: d.parent_id ?? "",
        status: d.status,
      })}
      toCreatePayload={toPayload}
      toUpdatePayload={toPayload}
      rowLabel={(d) => d.name}
      modalSize="md"
      renderDetail={(row, close) => <DistrictDetailPanel key={row.id} id={row.id} onClose={close} />}
    />
  );
}