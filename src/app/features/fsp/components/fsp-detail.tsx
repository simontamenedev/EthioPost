"use client";

import { StatusBadge } from "../../../../components/ui/badge";
import { DetailPanel, formatDateTime } from "../../../../components/ui/detail-panel";
import { errorMessage } from "../../../../lib/api/client";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { useRecordAuditLogs } from "../../../../lib/hooks/audit-hooks";
import { useFsp } from "../hooks";

export function FspDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: f, isLoading, error } = useFsp(id);
  const logs = useRecordAuditLogs("FinancialServiceProvider", id, isAdmin);

  return (
    <DetailPanel
      title={f?.name ?? "Provider"}
      subtitle="Financial service provider details"
      isLoading={isLoading}
      error={error ? errorMessage(error) : null}
      onClose={onClose}
      showAudit={isAdmin}
      audit={f?.audit}
      logs={logs.data}
      logsLoading={logs.isLoading}
      logsError={logs.error ? errorMessage(logs.error) : null}
      items={
        f
          ? [
              { label: "Status", value: <StatusBadge status={f.status} /> },
              { label: "Code", value: <span className="font-mono text-xs">{f.code}</span> },
              { label: "Commission rules", value: f.rule_count },
              { label: "Imported files", value: f.import_count },
              { label: "Description", value: f.description },
              { label: "Created", value: formatDateTime(f.created_at) },
              { label: "Updated", value: formatDateTime(f.updated_at) },
            ]
          : []
      }
    />
  );
}