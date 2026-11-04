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
};

export type Page<T> = { items: T[]; total: number; skip: number; limit: number };

export type Transaction = {
  id: string; agent_id: string | null; agent_shortcode: string; organization_name: string;
  region: string | null; import_batch_id: string; txn_date: string; service_type: string;
  channel: string; txn_status: string; debit_shortcode: string; credit_shortcode: string;
  txn_count: number; total_amount: string; failure_reason: string | null;
};
export type Registration = {
  id: string; agent_id: string | null; agent_shortcode: string; organization_name: string;
  region: string | null; import_batch_id: string; reg_date: string;
  customer_status: string; registration_count: number;
};
export type Upgrade = {
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
};

export type ImportBatch = {
  id: string; dataset: DatasetKey; filename: string; date_from: string | null; date_to: string | null;
  rows_total: number; rows_imported: number; rows_duplicate: number; rows_invalid: number;
  rows_unmatched: number; unmatched_shortcodes: string[] | null;
  errors: { line: number; error: string }[] | null; created_at: string;
};