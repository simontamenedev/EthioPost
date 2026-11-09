"use client";

import { Badge, StatusBadge } from "../../../../components/ui/badge";
import { DetailPanel, formatDateTime } from "../../../../components/ui/detail-panel";
import { errorMessage } from "../../../../lib/api/client";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { useRecordAuditLogs } from "../../../../lib/hooks/audit-hooks";
import { formatDate } from "../../../../lib/utils";
import { band, commissionText } from "../../transactions/const/format";
import { useCommissionRule } from "../hooks";

export function CommissionRuleDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: r, isLoading, error } = useCommissionRule(id);
  const logs = useRecordAuditLogs("CommissionRule", id, isAdmin);

  return (
    <DetailPanel
      title={r ? `${r.fsp.name} · ${r.service_type.name}` : "Commission rule"}
      subtitle={r?.qualifier ?? "Commission rule details"}
      isLoading={isLoading}
      error={error ? errorMessage(error) : null}
      onClose={onClose}
      showAudit={isAdmin}
      audit={r?.audit}
      logs={logs.data}
      logsLoading={logs.isLoading}
      logsError={logs.error ? errorMessage(logs.error) : null}
      items={
        r
          ? [
              { label: "Status", value: <StatusBadge status={r.status} /> },
              { label: "Provider", value: r.fsp.name },
              { label: "Service type", value: r.service_type.name },
              { label: "Qualifier", value: r.qualifier },
              { label: "Amount band (ETB)", value: band(r) },
              { label: "Commission", value: <span className="font-semibold">{commissionText(r)}</span> },
              { label: "Effective from", value: formatDate(r.effective_from) },
              { label: "Effective to", value: r.effective_to ? formatDate(r.effective_to) : <Badge tone="blue">Open</Badge> },
              { label: "Conditions", value: r.conditions },
              { label: "Created", value: formatDateTime(r.created_at) },
              { label: "Updated", value: formatDateTime(r.updated_at) },
            ]
          : []
      }
    />
  );
}