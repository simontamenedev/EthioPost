"use client";

import { DetailPanel, formatDateTime } from "../../../../components/ui/detail-panel";
import { StatusBadge } from "../../../../components/ui/badge";
import { errorMessage } from "../../../../lib/api/client";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { useBranch } from "../hooks";
import { useRecordAuditLogs } from "../../../../lib/hooks/audit-hooks";

export function BranchDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: b, isLoading, error } = useBranch(id);
  const logs = useRecordAuditLogs("Branch", id, isAdmin);

  return (
    <DetailPanel
      title={b?.name ?? "Branch"}
      subtitle="Branch details"
      isLoading={isLoading}
      error={error ? errorMessage(error) : null}
      onClose={onClose}
      showAudit={isAdmin}
      audit={b?.audit}
      logs={logs.data}
      logsLoading={logs.isLoading}
      logsError={logs.error ? errorMessage(logs.error) : null}
      items={
        b
          ? [
              { label: "Status", value: <StatusBadge status={b.status} /> },
              { label: "District", value: b.district.name },
              { label: "Agents", value: b.agent_count },
              { label: "Description", value: b.description },
              { label: "Created", value: formatDateTime(b.created_at) },
              { label: "Updated", value: formatDateTime(b.updated_at) },
            ]
          : []
      }
    />
  );
}