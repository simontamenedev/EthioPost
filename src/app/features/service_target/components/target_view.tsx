"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "../../../../components/ui/badge";
import type { Column } from "../../../../components/ui/data-table";
import type { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import { inputBase } from "../../../../components/ui/styles";
import type {
  ListParams,
  ServiceTypeTarget,
  ServiceTypeTargetPayload,
  ServiceTypeTargetUpdatePayload,
} from "../../../../lib/api/types";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { cn, formatDate } from "../../../../lib/utils";
import { useServiceTypes } from "../../service-types/hooks"; // adjust path to your service-types hooks
import { useCreateTarget, useDeleteTarget, useTargets, useUpdateTarget } from "../hooks";
import { targetSchema, type TargetFormValues } from "../schema";
import { DistrictAllocationEditor } from "./districtAllocationEditor";
import { PerformanceOverview } from "./performance-overview";
import { TargetBreakdown } from "./target-breakdown";
import { TargetDetailPanel } from "./target-detail";

const toPayload = (v: TargetFormValues): ServiceTypeTargetPayload => ({
  name: v.name || null,
  start_date: v.start_date,
  end_date: v.end_date,
  target_value: v.target_value,
  service_type_ids: v.service_type_ids,
  status: v.status,
});

// Dates are editable; the API checks overlaps and existing periods.
const toUpdatePayload = (v: TargetFormValues): ServiceTypeTargetUpdatePayload => toPayload(v);

const thisYear = new Date().getFullYear();
const num = (v: string | number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
const label = (r: ServiceTypeTarget) => r.name || r.service_types.map((s) => s.name).join(" + ");

export function TargetsView() {
  const create = useCreateTarget();
  const update = useUpdateTarget();
  const remove = useDeleteTarget();
  const serviceTypes = useServiceTypes({ limit: 200 });
  const isAdmin = useIsAdmin();
  const [splitting, setSplitting] = useState<ServiceTypeTarget | null>(null);
  const [range, setRange] = useState({ from: "", to: "" });

  // The table's list hook, with the date range added to every request.
  const useRangedTargets = (params: ListParams) =>
    useTargets({ ...params, date_from: range.from || undefined, date_to: range.to || undefined });

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
      {
        key: "dates",
        header: "Dates",
        cell: (r) => (
          <span className="whitespace-nowrap">
            {formatDate(r.start_date)} – {formatDate(r.end_date)}
          </span>
        ),
      },
      { key: "target", header: "Target", cell: (r) => <span className="tabular-nums">{num(r.target_value)}</span> },
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

  const fields = useMemo<FieldConfig<TargetFormValues>[]>(
    () => [
      { name: "name", label: "Name", placeholder: "e.g. Cash In + Cash Out" },
      { name: "start_date", label: "Start date", type: "date" },
      { name: "end_date", label: "End date", type: "date" },
      { name: "target_value", label: "Target", type: "number", placeholder: "Transaction count or amount" },
      {
        name: "service_type_ids",
        label: "Service types",
        type: "multiselect",
        options: serviceTypeOptions,
        hint: "A service type can be in only one target for any given date.",
      },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
    ],
    [serviceTypeOptions],
  );

  const dateFilter = (
    <div className="flex flex-wrap items-center gap-3" title="Shows targets that overlap this date range">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-white/70">
        From
        <input
          type="date"
          value={range.from}
          max={range.to || undefined}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          className={cn(inputBase, "!h-10 !w-40")}
        />
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-white/70">
        To
        <input
          type="date"
          value={range.to}
          min={range.from || undefined}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          className={cn(inputBase, "!h-10 !w-40")}
        />
      </label>
      {(range.from || range.to) && (
        <button
          type="button"
          onClick={() => setRange({ from: "", to: "" })}
          className="text-xs font-semibold text-slate-500 hover:underline dark:text-white/60"
        >
          Clear dates
        </button>
      )}
    </div>
  );

  return (
    <>
      <ResourceManager<ServiceTypeTarget, TargetFormValues, ServiceTypeTargetPayload, ServiceTypeTargetUpdatePayload>
        title="Targets"
        description="Targets per service type and date range, split across districts and months."
        singular="target"
        searchPlaceholder="Search targets…"
        columns={columns}
        useList={useRangedTargets}
        resetPageKey={`${range.from}|${range.to}`}
        createMutation={create}
        updateMutation={update}
        deleteMutation={remove}
        createSchema={targetSchema}
        fields={fields}
        emptyValues={{
          name: "",
          start_date: `${thisYear}-01-01`,
          end_date: `${thisYear}-12-31`,
          target_value: 0,
          service_type_ids: [],
          status: "active",
        }}
        toFormValues={(r) => ({
          name: r.name ?? "",
          start_date: r.start_date,
          end_date: r.end_date,
          target_value: Number(r.target_value),
          service_type_ids: r.service_types.map((s) => s.id),
          status: r.status,
        })}
        toCreatePayload={toPayload}
        toUpdatePayload={toUpdatePayload}
        rowLabel={label}
        modalSize="md"
        toolbarExtra={dateFilter}
        summary={<PerformanceOverview dateFrom={range.from || undefined} dateTo={range.to || undefined} />}
        renderDetail={(row, close) => <TargetDetailPanel key={row.id} id={row.id} onClose={close} />}
        renderExpanded={(row) => <TargetBreakdown key={row.id} target={row} />}
      />
      {splitting && <DistrictAllocationEditor target={splitting} open onClose={() => setSplitting(null)} />}
    </>
  );
}