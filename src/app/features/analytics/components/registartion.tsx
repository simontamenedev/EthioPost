"use client";

import { useMemo } from "react";
import type { Column } from "../../../../components/ui/data-table";
import type { Registration } from "../../../../lib/api/analytics-types";
import { formatInt } from "../../transactions/const/format";
import { ReportPage } from "./reports";

export function RegistrationsView() {
  const columns = useMemo<Column<Registration>[]>(
    () => [
      { key: "date", header: "Date", cell: (r) => r.reg_date },
      {
        key: "agent",
        header: "Agent",
        cell: (r) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{r.organization_name.replace("Ethiopia Postal Service Enterprise ", "")}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">{r.agent_shortcode} · {r.region ?? "—"}</p>
          </div>
        ),
      },
      { key: "status", header: "Customer status", cell: (r) => r.customer_status },
      { key: "count", header: "Registrations", cell: (r) => formatInt(r.registration_count) },
    ],
    [],
  );

  return (
    <ReportPage
      dataset="registrations"
      title="Customer registrations"
      description="New customers registered by each agent."
      columns={columns}
      sortField="reg_date"
      extraFilters={[{ param: "status", label: "statuses", options: (o) => o.customer_statuses }]}
    />
  );
}
