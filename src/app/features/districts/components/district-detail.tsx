"use client";

import { DetailPanel, formatDateTime } from "../../../../components/ui/detail-panel";
import { StatusBadge } from "../../../../components/ui/badge";
import { errorMessage } from "../../../../lib/api/client";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { useDistrict } from "../hooks";
import { useRecordAuditLogs } from "../../../../lib/hooks/audit-hooks";

export function DistrictDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: d, isLoading, error } = useDistrict(id);
  const logs = useRecordAuditLogs("District", id, isAdmin);

  const children = d?.children ?? [];

  return (
    <DetailPanel
      title={d?.name ?? "District"}
      subtitle="District details"
      isLoading={isLoading}
      error={error ? errorMessage(error) : null}
      onClose={onClose}
      showAudit={isAdmin}
      audit={d?.audit}
      logs={logs.data}
      logsLoading={logs.isLoading}
      logsError={logs.error ? errorMessage(logs.error) : null}
      items={
        d
          ? [
              { label: "Status", value: <StatusBadge status={d.status} /> },
              ...(d.parent_name ? [{ label: "Parent district", value: d.parent_name }] : []),
              {
                label: `Child districts (${children.length})`,
                value: children.length ? (
                  <ul className="space-y-1.5">
                    {children.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.name}</span>
                        <StatusBadge status={c.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  "None"
                ),
              },
              { label: children.length ? "Branches (incl. children)" : "Branches", value: d.branch_count },
              { label: children.length ? "Agents (incl. children)" : "Agents", value: d.agent_count },
              { label: "Description", value: d.description },
              { label: "Created", value: formatDateTime(d.created_at) },
              { label: "Updated", value: formatDateTime(d.updated_at) },
            ]
          : []
      }
    />
  );
}