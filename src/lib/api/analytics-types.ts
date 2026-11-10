export type DatasetKey = "transactions" | "registrations" | "upgrades";

export type AnalyticsFilters = {
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
  agent_shortcode?: string;
  region?: string;
  district_id?: string;
  branch_id?: string;
  batch_id?: string;
  service_type?: string; // transactions
  channel?: string; // transactions
  status?: string; // txn_status | customer_status
  before_level?: string; // upgrades
  after_level?: string; // upgrades
  min_amount?: number; // transactions
  max_amount?: number; // transactions
  q?: string;
  fsp_id?: string;
  district?: string;
};

export type Page<T> = { items: T[]; total: number; skip: number; limit: number };

export interface Transaction extends CommissionSnapshot {
  id: string; agent_id: string | null; agent_shortcode: string; organization_name: string;
  region: string | null; import_batch_id: string; txn_date: string; service_type: string;
  channel: string; txn_status: string; debit_shortcode: string; credit_shortcode: string;
  txn_count: number; total_amount: string; failure_reason: string | null;
  commission_rate: string | number | null;
  commission_amount: string | number | null;
};
export interface Registration extends CommissionSnapshot { 
  id: string; agent_id: string | null; agent_shortcode: string; organization_name: string;
  region: string | null; import_batch_id: string; reg_date: string;
  customer_status: string; registration_count: number;
};
export interface Upgrade extends CommissionSnapshot {
  id: string; agent_id: string | null; agent_shortcode: string; organization_name: string;
  region: string | null; import_batch_id: string; upgrade_date: string; upgrade_at: string;
  before_level: string; after_level: string; upgrade_count: number;
};

export type Summary = { active_agents: number; rows: number } & Record<string, number>;
export type SummaryWithPrevious = {
  current: Summary;
  previous: Summary | null;
  change_pct: Record<string, number | null> | null;
};
export type Overview = Record<DatasetKey, SummaryWithPrevious>;

export type SeriesPoint = { period: string; key?: string | null } & Record<string, number | string | null | undefined>;
export type BreakdownRow = { key: string; label: string } & Record<string, number | string>;

export type FilterOptions = {
  regions: string[]; service_types: string[]; channels: string[];
  transaction_statuses: string[]; customer_statuses: string[];
  before_levels: string[]; after_levels: string[];
  districts: string[];
};

export type ImportBatch = {
  id: string;fsp_id: string;   dataset: DatasetKey; filename: string; date_from: string | null; date_to: string | null;
  rows_total: number; rows_imported: number; rows_duplicate: number; rows_invalid: number;
  rows_unmatched: number; unmatched_shortcodes: string[] | null;
  errors: { line: number; error: string }[] | null; created_at: string;
};

export type CommissionStatus =
  | "CALCULATED"
  | "NO_RULE"
  | "NO_AGENT_RATE"
  | "NEEDS_FEE"
  | "NO_BASE"
  | "NOT_ELIGIBLE";

export interface CommissionSnapshot {
  commission_rule_id: string | null;
  commission_rate_id: string | null;
  fsp_commission_type: string | null;
  fsp_commission_basis: string | null;
  fsp_commission_rate: string | number | null;
  fsp_commission_amount: string | number | null;
  agent_commission_rate: string | number | null;
  agent_commission_amount: string | number | null;
  ethiopost_commission_amount: string | number | null;
  commission_status: CommissionStatus | null;
}

export interface DatasetSummary {
  current: Record<string, number>;
  previous: Record<string, number> | null;
  change_pct: Record<string, number | null> | null;
}

export interface DashboardTotals {
  fsp_commission: number;
  agent_commission: number;
  ethiopost_commission: number;
  amount: number;
  txns: number;
  registrations: number;
  upgrades: number;
  active_agents: number;
}
export interface FspRow extends DashboardTotals {
  fsp_id: string;
  fsp_name: string;
}
export interface TopRow {
  fsp_id: string;
  key: string;
  label: string;
  ethiopost: number;
  agent: number;
  fsp: number;
}
export interface OverallRow {
  key: string;
  label: string;
  ethiopost: number;
  agent: number;
  fsp: number;
}
export interface DashboardOverview {
  totals: DashboardTotals;
  previous: DashboardTotals | null;
  change_pct: Record<keyof DashboardTotals, number | null> | null;
  active: { agents: number; branches: number; districts: number; linked_agents: number };
  by_fsp: FspRow[];
  top_agents: TopRow[];
  top_districts: TopRow[];
  daily: { period: string; ethiopost: number; agent: number; fsp: number }[];
    overall: { agents: OverallRow[]; branches: OverallRow[]; districts: OverallRow[] };
}

export interface DashboardTotals {
  fsp_commission: number;
  agent_commission: number;
  ethiopost_commission: number;
  amount: number;
  txns: number;
  registrations: number;
  upgrades: number;
  active_agents: number;
}

export interface FspRow extends DashboardTotals {
  fsp_id: string;
  fsp_name: string;
}

export interface TopRow {
  fsp_id: string;
  key: string;
  label: string;
  ethiopost: number;
  agent: number;
  fsp: number;
}

export interface OverallRow {
  key: string;
  label: string;
  ethiopost: number;
  agent: number;
  fsp: number;
}

export interface DashboardOverview {
  totals: DashboardTotals;
  previous: DashboardTotals | null;
  change_pct: Record<keyof DashboardTotals, number | null> | null;
  active: { agents: number; branches: number; districts: number; linked_agents: number };
  by_fsp: FspRow[];
  top_agents: TopRow[];
  top_districts: TopRow[];
  overall: { agents: OverallRow[]; branches: OverallRow[]; districts: OverallRow[] };
  daily: { period: string; ethiopost: number; agent: number; fsp: number }[];
}
export interface DashboardTotals {
  fsp_commission: number;
  agent_commission: number;
  ethiopost_commission: number;
  amount: number;
  txns: number;
  registrations: number;
  upgrades: number;
  active_agents: number;
}

export interface FspRow extends DashboardTotals {
  fsp_id: string;
  fsp_name: string;
  records: number;
}

export interface TopRow {
  fsp_id: string;
  key: string;
  label: string;
  ethiopost: number;
  agent: number;
  fsp: number;
  records: number;
}

export interface OverallRow {
  key: string;
  label: string;
  ethiopost: number;
  agent: number;
  fsp: number;
  records: number;
}

export interface DashboardOverview {
  totals: DashboardTotals;
  previous: DashboardTotals | null;
  change_pct: Record<keyof DashboardTotals, number | null> | null;
  active: { agents: number; branches: number; districts: number; linked_agents: number };
  by_fsp: FspRow[];
  top_agents: TopRow[];
  top_districts: TopRow[];
  overall: { agents: OverallRow[]; branches: OverallRow[]; districts: OverallRow[] };
  daily: { period: string; ethiopost: number; agent: number; fsp: number }[];
}