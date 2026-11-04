"use client";

import { useMemo } from "react";
import type { Column } from "../../../../components/ui/data-table";
import type { Transaction } from "../../../../lib/api/analytics-types";import { formatBirr, formatInt } from "../const/format";
import { ReportPage } from "../../analytics/components/reports";
;

export function TransactionsView() {
  const columns = useMemo<Column<Transaction>[]>(
    () => [
      { key: "date", header: "Date", cell: (t) => t.txn_date },
      {
        key: "agent",
        header: "Agent",
        cell: (t) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{t.organization_name.replace("Ethiopia Postal Service Enterprise ", "")}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">{t.agent_shortcode} · {t.region ?? "—"}</p>
          </div>
        ),
      },
      { key: "service", header: "Service", cell: (t) => t.service_type },
      { key: "channel", header: "Channel", cell: (t) => t.channel },
      { key: "count", header: "Txns", cell: (t) => formatInt(t.txn_count) },
      { key: "amount", header: "Amount (ETB)", cell: (t) => formatBirr(t.total_amount) },
      { key: "status", header: "Status", cell: (t) => t.txn_status },
    ],
    [],
  );

  return (
    <ReportPage
      dataset="transactions"
      title="Transactions"
      description="Agent transaction volumes and values from the imported monitoring reports."
      columns={columns}
      sortField="txn_date"
      extraFilters={[
        { param: "service_type", label: "services", options: (o) => o.service_types },
        { param: "channel", label: "channels", options: (o) => o.channels },
      ]}
    />
  );
}
