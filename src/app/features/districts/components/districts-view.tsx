"use client";


import { StatusBadge } from "../../../../components/ui/badge";
import { Column } from "../../../../components/ui/data-table";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import { District, DistrictPayload } from "../../../../lib/api/types";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { formatDate } from "../../../../lib/utils";
import { useCreateDistrict, useDeleteDistrict, useDistricts, useUpdateDistrict } from "../hooks";
import { districtSchema, type DistrictFormValues } from "../schema";

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
  status: v.status,
});

export function DistrictsView() {
  const create = useCreateDistrict();
  const update = useUpdateDistrict();
  const remove = useDeleteDistrict();

  return (
    <ResourceManager<District, DistrictFormValues, DistrictPayload, Partial<DistrictPayload>>
      title="Districts"
      description="Top-level regions that branches and agents belong to."
      singular="district"
      searchPlaceholder="Search districts…"
      columns={columns}
      useList={useDistricts}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={districtSchema}
      fields={[
        { name: "name", label: "Name", placeholder: "e.g. Addis Ababa" },
        { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
        { name: "description", label: "Description", type: "textarea", placeholder: "Optional notes" },
      ]}
      emptyValues={{ name: "", description: "", status: "active" }}
      toFormValues={(d) => ({ name: d.name, description: d.description ?? "", status: d.status })}
      toCreatePayload={toPayload}
      toUpdatePayload={toPayload}
      rowLabel={(d) => d.name}
    />
  );
}
