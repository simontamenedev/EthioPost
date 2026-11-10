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
  NO_RULE: "No FSP rule",
  NO_AGENT_RATE: "No agent rate",
  NEEDS_FEE: "Needs fee data",
  NO_BASE: "No amount",
};

const money = (v: string | number | null | undefined) => (v == null ? "—" : formatBirr(v));

export function commissionColumns<T extends CommissionSnapshot>(): Column<T>[] {
  return [
    {
      key: "fsp_commission",
      header: "FSP commission (ETB)",
      cell: (r) => (
        <div>
          <p>{money(r.fsp_commission_amount)}</p>
          {r.fsp_commission_rate != null && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">
              {r.fsp_commission_type === "FLAT"
                ? `${Number(r.fsp_commission_rate)} ETB flat`
                : `${Number(r.fsp_commission_rate)}%`}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "agent_commission",
      header: "Agent (ETB)",
      cell: (r) => (
        <div>
          <p>{money(r.agent_commission_amount)}</p>
          {r.agent_commission_rate != null && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">
              {Number(r.agent_commission_rate)}% of FSP
            </p>
          )}
        </div>
      ),
    },
    {
      key: "ethiopost_commission",
      header: "Ethio Post (ETB)",
      cell: (r) => money(r.ethiopost_commission_amount),
    },
    {
      key: "commission_status",
      header: "Commission",
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