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
              { label: "Branches", value: d.branch_count },
              { label: "Agents", value: d.agent_count },
              { label: "Description", value: d.description },
              { label: "Created", value: formatDateTime(d.created_at) },
              { label: "Updated", value: formatDateTime(d.updated_at) },
            ]
          : []
      }
    />
  );
}