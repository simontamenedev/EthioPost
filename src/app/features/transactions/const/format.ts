import { CommissionBasis, CommissionRule } from "../../../../lib/api/types";


export const fmt = (v: string | number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 });

export const BASIS_LABEL: Record<CommissionBasis, string> = {
  txn_amount: "of amount",
  fee_collected: "of fees collected",
  revenue: "of revenue",
};

export function band(r: Pick<CommissionRule, "min_amount" | "max_amount">) {
  const { min_amount: lo, max_amount: hi } = r;
  if (lo == null && hi == null) return "Any amount";
  if (hi == null) return `≥ ${fmt(lo!)}`;
  if (lo == null) return `≤ ${fmt(hi)}`;
  return `${fmt(lo)} – ${fmt(hi)}`;
}

export function commissionText(r: Pick<CommissionRule, "commission_type" | "rate" | "basis">) {
  return r.commission_type === "flat"
    ? `${fmt(r.rate)} ETB`
    : `${fmt(r.rate)}% ${r.basis ? BASIS_LABEL[r.basis] : ""}`.trim();
}
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatInt = (n: number | string) => int.format(Number(n));
export const formatBirr = (n: number | string) => money.format(Number(n));
export const formatCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
