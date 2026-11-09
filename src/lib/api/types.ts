export type Status = "active" | "inactive";
export type UserRole = "admin" | "user";

type Audit = {
  id: string;
  status: Status;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type User = Audit & { name: string; username: string; email: string; role: UserRole };
export type District = Audit & { name: string; description: string | null,audit:AuditStamp | null,branch_count: string,agent_count:string  };
export type Branch = Audit & { name: string; description: string | null; district_id: string };
export type Agent = Audit & {
  parent_shortcode: string | null;
  agent_shortcode: string;
  agent_name: string;
  company_service_number: string | null;
  remark: string | null;
  branch_id: string;
  district_id: string;
};

export type TokenResponse = { access_token: string; token_type: string };


// ---- request payloads (what the API accepts) ----
export type DistrictPayload = { name: string; description: string | null; status: Status };
export type BranchPayload = { name: string; description: string | null; district_id: string; status: Status };
export type AgentPayload = {
  parent_shortcode: string | null;
  agent_shortcode: string;
  agent_name: string;
  company_service_number: string | null;
  remark: string | null;
  branch_id: string;
  district_id: string;
  status: Status;
};
export type UserCreatePayload = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  status: Status;
};
export type UserUpdatePayload = Partial<UserCreatePayload>;

export type ListParams = {
  skip?: number;
  limit?: number;
  q?: string;
  status?: Status;
};

export type CountStat = { total: number; active: number; inactive: number };
export type DashboardStats = { agents: CountStat; branches: CountStat; districts: CountStat };

export type UserRef = { id: string; email: string; full_name?: string | null };
export type AuditStamp = { created_by: UserRef | null; updated_by: UserRef | null };

export type AuditLog = {
  id: string;
  action: string; // "create" | "update" | "delete"
  model_name: string;
  record_id: string;
  user_id: string | null;
  user: UserRef | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type BranchDetail = Branch & { district: District; agent_count: number; audit?: AuditStamp | null };
export type DistrictDetail = District & { branch_count: number; agent_count: number; audit?: AuditStamp | null };
export type AgentDetail = Agent & { branch: Branch; district: District; audit?: AuditStamp | null };

export type CommissionRate = {
  id: string;
  service_name: string;
  rate: string | number; // percent; the API serialises Decimal as a string
  service_types: string[] | null;
  remark: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
};
export type CommissionRatePayload = {
  service_name: string;
  rate: number;
  service_types: string[] | null;
  remark: string | null;
  status: Status;
};

// lib/api/types.ts  - append (the legacy CommissionRate types can go once the old page is retired)
export type CommissionType = "flat" | "percent";
export type CommissionBasis = "txn_amount" | "fee_collected" | "revenue";

export type Fsp = {
  id: string; code: string; name: string; description: string | null;
  status: Status; created_at: string; updated_at: string;
};
export type FspPayload = { code: string; name: string; description: string | null; status: Status };

export type ServiceType = {
  id: string; code: string; name: string; csv_label: string | null; description: string | null;
  status: Status; created_at: string; updated_at: string;
};
export type ServiceTypePayload = {
  code: string; name: string; csv_label: string | null; description: string | null; status: Status;
};

export type CommissionRule = {
  id: string;
  fsp_id: string;
  service_type_id: string;
  fsp: { id: string; code: string; name: string };
  service_type: { id: string; code: string; name: string };
  qualifier: string | null;
  min_amount: string | number | null;   // Decimals arrive as strings
  max_amount: string | number | null;
  commission_type: CommissionType;
  basis: CommissionBasis | null;
  rate: string | number;                // ETB when flat, percent when percent
  conditions: string | null;
  effective_from: string;               // YYYY-MM-DD
  effective_to: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
};
export type CommissionRulePayload = {
  fsp_id: string;
  service_type_id: string;
  qualifier: string | null;
  min_amount: number | null;
  max_amount: number | null;
  commission_type: CommissionType;
  basis: CommissionBasis | null;
  rate: number;
  conditions: string | null;
  effective_from: string;
  effective_to: string | null;
  status: Status;
};
export type CommissionRuleFilters = { fsp_id?: string; service_type_id?: string };

export type FspDetail = Fsp & { rule_count: number; import_count: number; audit?: AuditStamp | null };
export type ServiceTypeDetail = ServiceType & { rule_count: number; audit?: AuditStamp | null };
export type CommissionRuleDetail = CommissionRule & { audit?: AuditStamp | null };