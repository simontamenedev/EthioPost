"use client";

import { useMemo } from "react";
import { useAgents, useCreateAgent, useDeleteAgent, useUpdateAgent } from "../hooks";
import { agentSchema, type AgentFormValues } from "../schema";
import { Agent, AgentPayload } from "../../../../lib/api/types";
import { useDistrictLookup } from "../../districts/hooks";
import { useBranchLookup } from "../../branches/hooks";
import { Column } from "../../../../components/ui/data-table";
import { FieldConfig } from "../../../../components/ui/entity-form";
import { StatusBadge } from "../../../../components/ui/badge";
import { STATUS_OPTIONS } from "../../../../lib/options";
import { ResourceManager } from "../../../../components/ui/resource-manager";
import { AgentDetailPanel } from "./agent-detail";

const toPayload = (v: AgentFormValues): AgentPayload => ({
  parent_shortcode: v.parent_shortcode || null,
  agent_shortcode: v.agent_shortcode,
  agent_name: v.agent_name,
  company_service_number: v.company_service_number || null,
  remark: v.remark || null,
  branch_id: v.branch_id,
  district_id: v.district_id,
  status: v.status,
});

export function AgentsView() {
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const remove = useDeleteAgent();
  const districts = useDistrictLookup();
  const branches = useBranchLookup();

  const columns = useMemo<Column<Agent>[]>(
    () => [
      {
        key: "agent",
        header: "Agent",
        cell: (a) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{a.agent_name}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">{a.agent_shortcode}</p>
          </div>
        ),
      },
      { key: "parent", header: "Parent", cell: (a) => a.parent_shortcode ?? "—" },
      { key: "service", header: "Service no.", cell: (a) => a.company_service_number ?? "—" },
      { key: "branch", header: "Branch", cell: (a) => branches.nameOf(a.branch_id) },
      { key: "district", header: "District", cell: (a) => districts.nameOf(a.district_id) },
      { key: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
    ],
    [branches, districts],
  );

  const fields = useMemo<FieldConfig<AgentFormValues>[]>(
    () => [
      { name: "agent_name", label: "Agent name", placeholder: "Full name or business name" },
      { name: "agent_shortcode", label: "Agent shortcode", placeholder: "e.g. AG001" },
      { name: "parent_shortcode", label: "Parent shortcode", placeholder: "Optional", hint: "Leave empty for a top-level agent." },
      { name: "company_service_number", label: "Company service number", placeholder: "Optional" },
      { name: "district_id", label: "District", type: "select", options: districts.options, placeholder: "Select a district" },
      {
        name: "branch_id",
        label: "Branch",
        type: "select",
        placeholder: "Select a branch",
        hint: "Only branches in the selected district are listed.",
        resetOn: "district_id",
        options: (values) =>
          branches.rows.filter((b) => b.district_id === values.district_id).map((b) => ({ value: b.id, label: b.name })),
      },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS, placeholder: "Select status" },
      { name: "remark", label: "Remark", type: "textarea", placeholder: "Optional notes" },
    ],
    [districts.options, branches.rows],
  );

  return (
    <ResourceManager<Agent, AgentFormValues, AgentPayload, Partial<AgentPayload>>
      title="Agents"
      description="Commission agents, assigned to a branch within a district."
      singular="agent"
      searchPlaceholder="Search by name or shortcode…"
      columns={columns}
      useList={useAgents}
      createMutation={create}
      updateMutation={update}
      deleteMutation={remove}
      createSchema={agentSchema}
      fields={fields}
      emptyValues={{
        parent_shortcode: "", agent_shortcode: "", agent_name: "", company_service_number: "",
        remark: "", district_id: "", branch_id: "", status: "active",
      }}
      toFormValues={(a) => ({
        parent_shortcode: a.parent_shortcode ?? "",
        agent_shortcode: a.agent_shortcode,
        agent_name: a.agent_name,
        company_service_number: a.company_service_number ?? "",
        remark: a.remark ?? "",
        district_id: a.district_id,
        branch_id: a.branch_id,
        status: a.status,
      })}
      toCreatePayload={toPayload}
      toUpdatePayload={toPayload}
            rowLabel={(a) => a.agent_name}
      renderDetail={(row, close) => <AgentDetailPanel key={row.id} id={row.id} onClose={close} />}

    />
  );
}
