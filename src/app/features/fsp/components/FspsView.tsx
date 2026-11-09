"use client";

import { useMemo } from "react";
import { StatusBadge } from "../../../../components/ui/badge";
import type { Column } from "../../../../components/ui/data-table";
import type { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import type { Fsp, FspPayload } from "../../../../lib/api/types";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { formatDate } from "../../../../lib/utils";
import { useCreateFsp, useDeleteFsp, useFsps, useUpdateFsp } from "../hooks";
import { fspSchema, type FspFormValues } from "../schema";
import { FspDetailPanel } from "./fsp-detail";

const toPayload = (v: FspFormValues): FspPayload => ({
  code: v.code,
  name: v.name,
  description: v.description || null,
  status: v.status,
});

export function FspsView() {
  const create = useCreateFsp();
  const update = useUpdateFsp();
  const remove = useDeleteFsp();

  const columns = useMemo<Column<Fsp>[]>(
    () => [
      {
        key: "name",
        header: "Provider",
        cell: (r) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
            {r.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-white/60">{r.description}</p>}
          </div>
        ),
      },
      { key: "code", header: "Code", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
      { key: "updated", header: "Updated", cell: (r) => formatDate(r.updated_at) },
    ],
    [],
  );

  const fields = useMemo<FieldConfig<FspFormValues>[]>(
    () => [
      { name: "name", label: "Name", placeholder: "e.g. Telebirr" },
      { name: "code", label: "Code", placeholder: "e.g. TELEBIRR", hint: "Short unique identifier, upper-case." },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
      { name: "description", label: "Description", type: "textarea", placeholder: "Optional notes" },
    ],
    [],
  );

  return (
    <ResourceManager<Fsp, FspFormValues, FspPayload, Partial<FspPayload>>
      title="Financial service providers"
      description="Wallets, banks and MNOs that Ethiopost DFS agents transact through."
      singular="provider"
      searchPlaceholder="Search providers…"
      columns={columns}
      useList={useFsps}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={fspSchema}
      fields={fields}
      emptyValues={{ code: "", name: "", description: "", status: "active" }}
      toFormValues={(r) => ({ code: r.code, name: r.name, description: r.description ?? "", status: r.status })}
      toCreatePayload={toPayload}
      toUpdatePayload={toPayload}
      rowLabel={(r) => r.name}
      modalSize="md"
      renderDetail={(row, close) => <FspDetailPanel key={row.id} id={row.id} onClose={close} />}
    />
  );
}