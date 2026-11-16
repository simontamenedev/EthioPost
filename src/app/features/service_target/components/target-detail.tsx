"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { StatusBadge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { DetailPanel, formatDateTime } from "../../../../components/ui/detail-panel";
import { errorMessage } from "../../../../lib/api/client";
import { useIsAdmin } from "../../../../lib/auth/use-auth";
import { useRecordAuditLogs } from "../../../../lib/hooks/audit-hooks";
import { useTarget } from "../hooks";
import { DistrictAllocationEditor } from "./districtAllocationEditor";
import { MonthAllocationEditor } from "./monthAllocationEditor";

const num = (v: string | number) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (v: string | number | null | undefined) => `${Number(v ?? 0).toFixed(2)}%`;

export function TargetDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const { data: t, isLoading, error } = useTarget(id);
  const logs = useRecordAuditLogs("ServiceTypeTarget", id, isAdmin);
  const [editing, setEditing] = useState(false);
  const [phasingFor, setPhasingFor] = useState<string | null>(null); // district_id
  return (
    <>
      <DetailPanel
        title={t?.name || (t ? t.service_types.map((s) => s.name).join(" + ") : "Annual target")}
        subtitle="Annual target details"
        isLoading={isLoading}
        error={error ? errorMessage(error) : null}
        onClose={onClose}
        showAudit={isAdmin}
        audit={t?.audit}
        logs={logs.data}
        logsLoading={logs.isLoading}
        logsError={logs.error ? errorMessage(logs.error) : null}
        items={
          t
            ? [
                { label: "Status", value: <StatusBadge status={t.status} /> },
                { label: "Year", value: t.year },
                { label: "Service types", value: t.service_types.map((s) => s.name).join(", ") },
                { label: "Annual target", value: num(t.target_value) },
                { label: "Allocated to districts", value: `${num(t.allocated_value)} (${pct(t.allocated_percent)})` },
                { label: "Unallocated", value: `${num(t.unallocated_value)} (${pct(t.unallocated_percent)})` },
                {
                  label: "Districts",
                  value: (
                    <div className="space-y-2">
                      {t.district_targets.length ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500 dark:text-white/60">
                              <th className="py-1 font-medium">District</th>
                              <th className="py-1 text-right font-medium">Target</th>
                              <th className="py-1 text-right font-medium">Share</th>
                              <th className="py-1 text-right font-medium">Phased</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.district_targets.map((d) => (
                              <tr key={d.id}>
                                <td className="py-1">{d.district.name}</td>
                                <td className="py-1 text-right tabular-nums">{num(d.target_value)}</td>
                                <td className="py-1 text-right tabular-nums">{pct(d.target_percent)}</td>
                                <td className="py-1 text-right tabular-nums">
  {pct(d.phased_percent)}
  {isAdmin && (
    <button
      type="button"
      onClick={() => setPhasingFor(d.district_id)}
      className="ml-2 text-xs font-semibold text-[#2c317b] hover:underline dark:text-white"
    >
      {Number(d.phased_percent) > 0 ? "Edit months" : "Set months"}
    </button>
  )}
</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <span>Not split across districts yet</span>
                      )}
                      {isAdmin && (
                        <Button icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
                          {t.district_targets.length ? "Edit split" : "Set up split"}
                        </Button>
                      )}
                    </div>
                  ),
                },
                { label: "Created", value: formatDateTime(t.created_at) },
                { label: "Updated", value: formatDateTime(t.updated_at) },
              ]
            : []
        }
      />
      {t && isAdmin && <DistrictAllocationEditor target={t} open={editing} onClose={() => setEditing(false)} />}
        {t && isAdmin && phasingFor && (
  <MonthAllocationEditor targetId={t.id} districtId={phasingFor} open onClose={() => setPhasingFor(null)} />
)}
    </>
  );
}