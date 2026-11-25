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
export type District = Audit & { name: string; description: string | null,audit:AuditStamp | null,branch_count: string,agent_count:string,parent_id: string | null,parent_name: string | null,children: DistrictChild[] };
export type Branch = Audit & { name: string; description: string | null; district_id: string,audit:AuditStamp | null,agent_count:string,district:{ id: string; name: string } };
export type Agent = Audit & {
  parent_shortcode: string | null;
  agent_shortcode: string;
  agent_name: string;
  company_service_number: string | null;
  remark: string | null;
  audit:AuditStamp | null;
  district:{ id: string; name: string }
  branch:{ id: string; name: string }
  branch_id: string;
  district_id: string;
};

export type TokenResponse = { access_token: string; token_type: string };


// ---- request payloads (what the API accepts) ----
export type DistrictPayload = { name: string; description: string | null; status: Status,parent_id: string | null };
export type DistrictChild = Pick<District, "id" | "name" | "description" | "status" | "parent_id">;
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
  parents_only?: boolean; parent_id?: string
   date_from?: string;
  date_to?: string;
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
export type DistrictDetail = District & { branch_count: number; agent_count: number; audit?: AuditStamp | null,parent_name: string | null; children: DistrictChild[] };
export type AgentDetail = Agent & { branch: Branch; district: District; audit?: AuditStamp | null };

export type CommissionRate = {
  id: string;
  service_name: string;
  rate: string | number; // percent; the API serialises Decimal as a string
  service_types: TargetServiceType[]; // { id, code, name }
  remark: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
};
export type CommissionRatePayload = {
  service_name: string;
  rate: number;
  service_type_ids: string[];
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
  sort_order: number
};
export type ServiceTypePayload = {
  code: string; name: string; csv_label: string | null; description: string | null; status: Status;
  sort_order?: number
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

// lib/api/types.ts - append

// lib/api/types.ts - append

// ---- annual targets ----
export type TargetServiceType = { id: string; code: string; name: string };

export type ServiceTypeTarget = {
  id: string;
  name: string | null;
  start_date:string;
  end_date:string;
  target_value: string | number;        // Decimals arrive as strings
  status: Status;
  created_at: string;
  updated_at: string;
  service_types: TargetServiceType[];
  allocated_value: string | number;
  unallocated_value: string | number;
  allocated_percent: string | number;
  unallocated_percent: string | number;
};

export type DistrictTarget = {
  phased_percent: string | number;
  id: string;
  monthly_targets: { month: number; percent: string | number; target_value: string | number }[];
  district_id: string;
  district: { id: string; name: string };
  target_value: string | number;
  target_percent: string | number;
};

export type ServiceTypeTargetDetail = ServiceTypeTarget & {
  district_targets: DistrictTarget[];
  audit?: AuditStamp | null;
};

export type ServiceTypeTargetPayload = {
  name: string | null;
  start_date:string;
  end_date:string;
  target_value: number;
  service_type_ids: string[];
  status: Status;
};
/** The year cannot change after creation. */
export type ServiceTypeTargetUpdatePayload = Partial<Omit<ServiceTypeTargetPayload, "year">> & {
  keep_percentages?: boolean;
};
export type ServiceTypeTargetFilters = { year?: number; service_type_id?: string, date_from?: string;
  date_to?: string; };

export type DistrictAllocationMode = "value" | "percent" | "even";
export type DistrictAllocationPayload = {
  mode: DistrictAllocationMode;
  allocations: { district_id: string; amount: number | null }[];
};

/** One row of the district allocation editor (every active district, 0 when unallocated). */
export type DistrictAllocationRow = {
  district_id: string;
  district_name: string;
  target_value: string | number;
  target_percent: string | number;
};

export interface MonthTarget { month: number; percent: string | number; target_value: string | number }

// on the item type of ServiceTypeTargetDetail.district_targets, add:
//   phased_percent: string | number;
//   monthly_targets: MonthTarget[];

export interface MonthAllocationResponse {
  district_id: string;
  district_name: string;
  target_value: string | number;
  months: MonthTarget[];
}
export interface MonthAllocationPayload {
  mode: "percent" | "even";
  months: { month: number; percent: number }[];
  apply_to_all_districts: boolean;
}
export interface MonthPerformance {
  month: number; target_value: string | number; actual_value: string | number;
  variance: string | number; achievement_percent: string | number | null;
}
export interface DistrictPerformance {
  district_id: string; district_name: string; target_value: string | number;
  actual_value: string | number; variance: string | number;
  achievement_percent: string | number | null; months: MonthPerformance[];
}
export interface TargetPerformance {
  target_id: string; name: string | null; year: number; metric: "amount" | "count";
  target_value: string | number; allocated_value: string | number; actual_value: string | number;
  achievement_percent: string | number | null; actual_outside_districts: string | number;
  districts: DistrictPerformance[];
}

export type PeriodTarget = {
  id: string;
  start_date: string;       // YYYY-MM-DD
  end_date: string;
  target_value: string | number;
  status?: Status;
};

export interface PeriodTargetInput {
  id?: string | null;
  start_date: string;
  end_date: string;
  target_value: number;
}

type Num = string | number;
export type PerformanceMetric = "amount" | "count";

export interface MonthPerformance {
  month: number; target_value: Num; actual_value: Num; variance: Num; achievement_percent: Num | null;
}
export interface DistrictPerformance {
  district_id: string; district_name: string; target_value: Num; actual_value: Num;
  variance: Num; achievement_percent: Num | null; months: MonthPerformance[];
}
export interface TargetPerformance {
  target_id: string; name: string | null; start_date: string; end_date: string;
  metric: PerformanceMetric; target_value: Num; allocated_value: Num; actual_value: Num;
  achievement_percent: Num | null; actual_outside_districts: Num; districts: DistrictPerformance[];
}

// ServiceTypeTargetFilters: make sure it has  date_from?: string; date_to?: string;
// ServiceTypeTargetDetail.district_targets[]: make sure it has
//   monthly_targets: { month: number; percent: Num; target_value: Num }[]