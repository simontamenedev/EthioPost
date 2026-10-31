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
export type District = Audit & { name: string; description: string | null };
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
