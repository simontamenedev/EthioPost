"use client";

import { useMemo } from "react";

import { useBranches, useCreateBranch, useDeleteBranch, useUpdateBranch } from "../hooks";
import { branchSchema, type BranchFormValues } from "../schema";
import { Branch, BranchPayload } from "../../../../lib/api/types";
import { useDistrictLookup } from "../../districts/hooks";
import { Column } from "../../../../components/ui/data-table";
import { StatusBadge } from "../../../../components/ui/badge";
import { formatDate } from "../../../../lib/utils";
import { FieldConfig } from "../../../../components/ui/entity-form";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { ResourceManager } from "../../../../components/ui/resource-manager";

const toPayload = (v: BranchFormValues): BranchPayload => ({
  name: v.name,
  description: v.description || null,
  district_id: v.district_id,
  status: v.status,
});

export function BranchesView() {
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const remove = useDeleteBranch();
  const districts = useDistrictLookup();

  const columns = useMemo<Column<Branch>[]>(
    () => [
      {
        key: "name",
        header: "Branch",
        cell: (b) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{b.name}</p>
            {b.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-white/60">{b.description}</p>}
          </div>
        ),
      },
      { key: "district", header: "District", cell: (b) => districts.nameOf(b.district_id) },
      { key: "status", header: "Status", cell: (b) => <StatusBadge status={b.status} /> },
      { key: "created", header: "Created", cell: (b) => formatDate(b.created_at) },
    ],
    [districts],
  );

  const fields = useMemo<FieldConfig<BranchFormValues>[]>(
    () => [
      { name: "name", label: "Name", placeholder: "e.g. Bole Branch" },
      { name: "district_id", label: "District", type: "select", options: districts.options, placeholder: "Select a district" },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
      { name: "description", label: "Description", type: "textarea", placeholder: "Optional notes" },
    ],
    [districts.options],
  );

  return (
    <ResourceManager<Branch, BranchFormValues, BranchPayload, Partial<BranchPayload>>
      title="Branches"
      description="Branches operate inside a district and host agents."
      singular="branch"
      searchPlaceholder="Search branches…"
      columns={columns}
      useList={useBranches}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={branchSchema}
      fields={fields}
      emptyValues={{ name: "", description: "", district_id: "", status: "active" }}
      toFormValues={(b) => ({ name: b.name, description: b.description ?? "", district_id: b.district_id, status: b.status })}
      toCreatePayload={toPayload}
      toUpdatePayload={toPayload}
      rowLabel={(b) => b.name}
    />
  );
}
