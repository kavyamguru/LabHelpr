"use client";
import { ExportPayload } from "../../../lib/stats/descriptive/exportTypes";

export function AnalysisAudit({ payload }: { payload: ExportPayload }) {
  return (
    <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Analysis audit</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, fontSize: 13, color: "#374151" }}>
        <AuditRow label="Timestamp" value={payload.timestamp} />
        <AuditRow label="Source type" value={payload.audit.sourceType} />
        <AuditRow label="Detected structure" value={payload.audit.inferredStructure} />
        <AuditRow label="Response" value={payload.audit.mapping.response ?? "n/a"} />
        <AuditRow label="Group" value={payload.audit.mapping.group ?? "n/a"} />
        <AuditRow label="Replicate mode" value={payload.audit.replicateMode} />
        <AuditRow label="Collapse technical" value={payload.audit.collapseTechnical ? "Yes" : "No"} />
        <AuditRow label="Control group" value={payload.controlGroup ?? "none"} />
        <AuditRow label="Missing tokens" value={(payload.audit.missingTokens || []).join(", ") || "default"} />
        <AuditRow label="Units" value={payload.units ?? "n/a"} />
      </div>
    </div>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div>{value || "n/a"}</div>
    </div>
  );
}
