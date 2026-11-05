"use client";

import { DetailPanel, formatDateTime } from "../../../../components/ui/detail-panel";
import { StatusBadge } from "../../../../components/ui/badge";
import { errorMessage } from "../../../../lib/api/client";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { useAgent } from "../hooks";
import { useRecordAuditLogs } from "../../../../lib/hooks/audit-hooks";

export function AgentDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: a, isLoading, error } = useAgent(id);
  const logs = useRecordAuditLogs("Agent", id, isAdmin);

  return (
    <DetailPanel
      title={a?.agent_name ?? "Agent"}
      subtitle={a?.agent_shortcode}
      isLoading={isLoading}
      error={error ? errorMessage(error) : null}
      onClose={onClose}
      showAudit={isAdmin}
      audit={a?.audit}
      logs={logs.data}
      logsLoading={logs.isLoading}
      logsError={logs.error ? errorMessage(logs.error) : null}
      items={
        a
          ? [
              { label: "Status", value: <StatusBadge status={a.status} /> },
              { label: "Shortcode", value: a.agent_shortcode },
              { label: "Parent shortcode", value: a.parent_shortcode },
              { label: "Service number", value: a.company_service_number },
              { label: "Branch", value: a.branch.name },
              { label: "District", value: a.district.name },
              { label: "Remark", value: a.remark },
              { label: "Created", value: formatDateTime(a.created_at) },
              { label: "Updated", value: formatDateTime(a.updated_at) },
            ]
          : []
      }
    />
  );
}