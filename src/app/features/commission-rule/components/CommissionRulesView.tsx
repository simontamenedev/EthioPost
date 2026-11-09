"use client";

import { useMemo, useState } from "react";
import { Badge, StatusBadge } from "../../../../components/ui/badge";
import type { Column } from "../../../../components/ui/data-table";
import type { FieldConfig } from "../../../../components/ui/entity-form";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import { inputBase } from "../../../../components/ui/styles";
import type { CommissionBasis, CommissionRule, CommissionRulePayload, ListParams } from "../../../../lib/api/types";
import { COMMISSION_BASIS_OPTIONS, COMMISSION_TYPE_OPTIONS, STATUS_OPTIONS } from "../../../../lib/options";
import { cn, formatDate } from "../../../../lib/utils";
import { useFsps } from "../../fsp/hooks";
import { useServiceTypes } from "../../service-types/hooks";
import { useCommissionRules, useCreateCommissionRule, useDeleteCommissionRule, useUpdateCommissionRule } from "../hooks";
import { commissionRuleSchema, type CommissionRuleFormValues } from "../schema";
import { CommissionRuleDetailPanel } from "./commission-rule-detail";
import { band, commissionText } from "../../transactions/const/format";

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const toPayload = (v: CommissionRuleFormValues): CommissionRulePayload => ({
  fsp_id: v.fsp_id,
  service_type_id: v.service_type_id,
  qualifier: v.qualifier || null,
  min_amount: num(v.min_amount),
  max_amount: num(v.max_amount),
  commission_type: v.commission_type,
  basis: v.commission_type === "percent" ? (v.basis as CommissionBasis) : null,
  rate: Number(v.rate),
  conditions: v.conditions || null,
  effective_from: v.effective_from,
  effective_to: v.effective_to || null,
  status: v.status,
});

export function CommissionRulesView() {
  const create = useCreateCommissionRule();
  const update = useUpdateCommissionRule();
  const remove = useDeleteCommissionRule();
  const [fspFilter, setFspFilter] = useState("");

  // Named "use…" function so the rules-of-hooks lint accepts the call.
  // ResourceManager calls it as its `useList` on every render.
  const useFilteredRules = (params: ListParams) =>
    useCommissionRules({ ...params, ...(fspFilter ? { fsp_id: fspFilter } : {}) });

  const fsps = useFsps({ limit: 200 });
  const serviceTypes = useServiceTypes({ limit: 200 });
  const fspOptions = useMemo(() => (fsps.data ?? []).map((f) => ({ value: f.id, label: f.name })), [fsps.data]);
  const serviceOptions = useMemo(
    () => (serviceTypes.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    [serviceTypes.data],
  );

  const columns = useMemo<Column<CommissionRule>[]>(
    () => [
      {
        key: "fsp",
        header: "Provider / service",
        cell: (r) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{r.fsp.name}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">
              {r.service_type.name}
              {r.qualifier ? ` · ${r.qualifier}` : ""}
            </p>
          </div>
        ),
      },
      { key: "band", header: "Amount band (ETB)", cell: (r) => <span className="tabular-nums">{band(r)}</span> },
      {
        key: "rate",
        header: "Commission",
        cell: (r) => <span className="font-semibold tabular-nums">{commissionText(r)}</span>,
      },
      {
        key: "period",
        header: "Effective",
        cell: (r) => (
          <span className="text-xs">
            {formatDate(r.effective_from)} → {r.effective_to ? formatDate(r.effective_to) : <Badge tone="blue">Open</Badge>}
          </span>
        ),
      },
      { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    ],
    [],
  );

  const fields = useMemo<FieldConfig<CommissionRuleFormValues>[]>(
    () => [
      { name: "fsp_id", label: "Financial service provider", type: "select", options: fspOptions, placeholder: "Select provider" },
      { name: "service_type_id", label: "Service type", type: "select", options: serviceOptions, placeholder: "Select service" },
      { name: "qualifier", label: "Qualifier", placeholder: "e.g. registered customer, sub-agent, DSTV", hint: "Optional sub-case within the service." },
      { name: "min_amount", label: "Minimum amount (ETB)", placeholder: "e.g. 101", hint: "Leave both amounts empty if it applies to any amount." },
      { name: "max_amount", label: "Maximum amount (ETB)", placeholder: "e.g. 500 (empty = no upper limit)" },
      { name: "commission_type", label: "Commission type", type: "select", options: COMMISSION_TYPE_OPTIONS, placeholder: "Select type" },
      { name: "rate", label: "Rate", placeholder: "ETB if flat, percent if percentage", hint: "Flat: 5 = 5 ETB. Percentage: 0.2 = 0.2%." },
      { name: "basis", label: "Percentage basis", type: "select", options: COMMISSION_BASIS_OPTIONS, placeholder: "Only for percentage rates" },
      { name: "effective_from", label: "Effective from", type: "date" },
      { name: "effective_to", label: "Effective to", type: "date", hint: "Empty = still in force. To change a rate, close this one and add a new rule." },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
      { name: "conditions", label: "Conditions", type: "textarea", placeholder: "Milestones, minimum txn counts, revenue shares…" },
    ],
    [fspOptions, serviceOptions],
  );

  return (
    <ResourceManager<CommissionRule, CommissionRuleFormValues, CommissionRulePayload, Partial<CommissionRulePayload>>
      title="Commission rules"
      description="Commission per provider, service and amount band."
      singular="commission rule"
      searchPlaceholder="Search qualifier or conditions…"
      columns={columns}
      useList={useFilteredRules}
      toolbarExtra={
        <select
          aria-label="Filter by provider"
          value={fspFilter}
          onChange={(e) => setFspFilter(e.target.value)}
          className={cn(inputBase, "h-10 w-full sm:w-52")}
        >
          <option value="">All providers</option>
          {fspOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      }
      resetPageKey={fspFilter}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={commissionRuleSchema}
      fields={fields}
      emptyValues={{
        fsp_id: "", service_type_id: "", qualifier: "", min_amount: "", max_amount: "",
        commission_type: "flat", basis: "", rate: "", conditions: "",
        effective_from: new Date().toISOString().slice(0, 10), effective_to: "", status: "active",
      }}
      toFormValues={(r) => ({
        fsp_id: r.fsp_id,
        service_type_id: r.service_type_id,
        qualifier: r.qualifier ?? "",
        min_amount: r.min_amount == null ? "" : String(Number(r.min_amount)),
        max_amount: r.max_amount == null ? "" : String(Number(r.max_amount)),
        commission_type: r.commission_type,
        basis: r.basis ?? "",
        rate: String(Number(r.rate)),
        conditions: r.conditions ?? "",
        effective_from: r.effective_from,
        effective_to: r.effective_to ?? "",
        status: r.status,
      })}
      toCreatePayload={toPayload}
      toUpdatePayload={toPayload}
      rowLabel={(r) => `${r.fsp.name} · ${r.service_type.name}`}
      modalSize="lg"
      renderDetail={(row, close) => <CommissionRuleDetailPanel key={row.id} id={row.id} onClose={close} />}
    />
  );
}