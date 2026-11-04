"use client";

import { useMemo } from "react";
import type { Column } from "../../../../components/ui/data-table";
import type { Upgrade } from "../../../../lib/api/analytics-types";
import { formatInt } from "../../transactions/const/format";
import { ReportPage } from "./reports";

export function UpgradesView() {
  const columns = useMemo<Column<Upgrade>[]>(
    () => [
      { key: "date", header: "Date", cell: (u) => u.upgrade_date },
      {
        key: "agent",
        header: "Agent",
        cell: (u) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{u.organization_name.replace("Ethiopia Postal Service Enterprise ", "")}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/60">{u.agent_shortcode} · {u.region ?? "—"}</p>
          </div>
        ),
      },
      { key: "from", header: "From", cell: (u) => u.before_level },
      { key: "to", header: "To", cell: (u) => u.after_level },
      { key: "count", header: "Upgrades", cell: (u) => formatInt(u.upgrade_count) },
    ],
    [],
  );

  return (
    <ReportPage
      dataset="upgrades"
      title="Customer upgrades"
      description="Customers upgraded to a higher account level by each agent."
      columns={columns}
      sortField="upgrade_date"
      extraFilters={[
        { param: "before_level", label: "from levels", options: (o) => o.before_levels },
        { param: "after_level", label: "to levels", options: (o) => o.after_levels },
      ]}
    />
  );
}
