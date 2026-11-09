"use client";

import { Badge, StatusBadge } from "../../../../components/ui/badge";
import { DetailPanel, formatDateTime } from "../../../../components/ui/detail-panel";
import { errorMessage } from "../../../../lib/api/client";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { useRecordAuditLogs } from "../../../../lib/hooks/audit-hooks";
import { useServiceType } from "../hooks";

export function ServiceTypeDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: s, isLoading, error } = useServiceType(id);
  const logs = useRecordAuditLogs("ServiceType", id, isAdmin);

  return (
    <DetailPanel
      title={s?.name ?? "Service type"}
      subtitle="Service type details"
      isLoading={isLoading}
      error={error ? errorMessage(error) : null}
      onClose={onClose}
      showAudit={isAdmin}
      audit={s?.audit}
      logs={logs.data}
      logsLoading={logs.isLoading}
      logsError={logs.error ? errorMessage(logs.error) : null}
      items={
        s
          ? [
              { label: "Status", value: <StatusBadge status={s.status} /> },
              { label: "Code", value: <span className="font-mono text-xs">{s.code}</span> },
              {
                label: "CSV service type",
                value: s.csv_label ? <Badge tone="blue">{s.csv_label}</Badge> : "Not in reports",
              },
              { label: "Commission rules", value: s.rule_count },
              { label: "Description", value: s.description },
              { label: "Created", value: formatDateTime(s.created_at) },
              { label: "Updated", value: formatDateTime(s.updated_at) },
            ]
          : []
      }
    />
  );
}