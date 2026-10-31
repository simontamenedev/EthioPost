import { createCrudHooks } from "../../../lib/api/crud-hooks";
import { Agent, AgentPayload } from "../../../lib/api/types";


const agents = createCrudHooks<
  Agent,
  AgentPayload,
  Partial<AgentPayload>,
  { branch_id?: string; district_id?: string; parent_shortcode?: string }
>("agents");

export const agentKeys = agents.keys;
export const useAgents = agents.useList;
export const useAgent = agents.useOne;
export const useCreateAgent = agents.useCreate;
export const useUpdateAgent = agents.useUpdate;
export const useDeleteAgent = agents.useDelete;
