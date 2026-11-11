import type { Column } from "../../../../components/ui/data-table";
import type { CommissionSnapshot } from "../../../../lib/api/analytics-types";
import { formatBirr } from "../../transactions/const/format";

const STATUS_STYLE: Record<string, string> = {
  CALCULATED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  NOT_ELIGIBLE: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/60",
};
const WARN = "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";

const STATUS_LABEL: Record<string, string> = {
  CALCULATED: "Calculated",
  NOT_ELIGIBLE: "Not eligible",
  NO_RULE: "No commission rule",
  NO_AGENT_RATE: "Legacy: no agent rate", // old rows only; the backend no longer produces it
  NEEDS_FEE: "Needs fee data",
  NO_BASE: "No amount",
};

const money = (v: string | number | null | undefined) => (v == null ? "—" : formatBirr(v));

/** The rule is what Ethio Post earns: flat -> "8 ETB / txn", percent -> "1%". */
function ruleLabel(type: string | null, rate: string | number | null): string | null {
  if (rate == null) return null;
  const n = Number(rate);
  if (Number.isNaN(n)) return null;
  return (type ?? "").toLowerCase() === "flat" ? `${n} ETB / txn` : `${n}%`;
}

export function commissionColumns<T extends CommissionSnapshot>(): Column<T>[] {
  return [
    {
      key: "commission",
      header: "Commission (ETB)",
      cell: (r) => {
        const rule = ruleLabel(r.fsp_commission_type, r.fsp_commission_rate);
        return (
          <div>
            <p>{money(r.fsp_commission_amount)}</p>
            {rule && <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">{rule}</p>}
          </div>
        );
      },
    },
    {
      key: "agent_commission",
      header: "Agent (ETB)",
      cell: (r) => {
        const pct = r.agent_commission_rate == null ? 0 : Number(r.agent_commission_rate);
        return (
          <div>
            <p>{money(r.agent_commission_amount)}</p>
            {pct > 0 && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">{pct}% of commission</p>
            )}
          </div>
        );
      },
    },
    {
      key: "ethiopost_commission",
      header: "Ethio Post (ETB)",
      cell: (r) => money(r.ethiopost_commission_amount),
    },
    {
      key: "commission_status",
      header: "Status",
      cell: (r) =>
        r.commission_status == null ? (
          "—"
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLE[r.commission_status] ?? WARN
            }`}
          >
            {STATUS_LABEL[r.commission_status] ?? r.commission_status}
          </span>
        ),
    },
  ];
}