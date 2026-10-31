export type CellPrimitive = string | number | null;

export type CommissionRecord = {
  id: string;
  agent: string;
  branch: string;
  district: string;
  date: string;
  amount: number | null;
  commission: number;
  source: Record<string, CellPrimitive>;
};

export type CommissionLevel = "Agent" | "Branch" | "District";

export type CommissionSummary = {
  name: string;
  records: number;
  amount: number;
  commission: number;
};

export type ColumnMapping = {
  agent: number | null;
  branch: number | null;
  district: number | null;
  date: number | null;
  amount: number | null;
  commission: number | null;
  rate: number | null;
};

export type ParsedSheet = {
  headers: string[];
  rows: CellPrimitive[][];
  worksheetName: string;
};
