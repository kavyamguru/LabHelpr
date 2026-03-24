"use client";
import { useState } from "react";
import { ExportPayload } from "../../../lib/stats/descriptive/exportTypes";
import { exportCsvOverall, exportCsvByGroup, exportCsvMissing, exportCsvOutliers, exportCsvControlComparisons } from "../../../lib/stats/descriptive/exportCsv";
import { exportJson } from "../../../lib/stats/descriptive/exportJson";
import { exportPdf } from "../../../lib/stats/descriptive/reportPdf";
import { exportExcel } from "../../../lib/stats/descriptive/exportExcel";
import { buildMethodsText, buildResultsText } from "../../../lib/stats/descriptive/reportText";

function download(name: string, mime: string, data: string | Uint8Array | ArrayBuffer) {
  const blob = typeof data === "string"
    ? new Blob([data], { type: mime })
    : data instanceof ArrayBuffer
      ? new Blob([data], { type: mime })
      : new Blob([new Uint8Array(data)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportsPanel({ payload }: { payload: ExportPayload }) {
  const [methodsText, setMethodsText] = useState(buildMethodsText(payload));
  const [resultsText, setResultsText] = useState(buildResultsText(payload));

  return (
    <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Exports</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Response: {payload.audit.mapping.response ?? "n/a"} · Group: {payload.audit.mapping.group ?? "n/a"} · Replicates: {payload.audit.replicateMode} ({payload.audit.collapseTechnical ? "collapse tech" : "tech visible"}) · Control: {payload.controlGroup ?? "none"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="ghost-button" type="button" onClick={() => download("overall.csv", "text/csv", exportCsvOverall(payload))}>CSV (overall)</button>
          <button className="ghost-button" type="button" onClick={() => download("by-group.csv", "text/csv", exportCsvByGroup(payload))}>CSV (groups)</button>
          <button className="ghost-button" type="button" onClick={() => download("missingness.csv", "text/csv", exportCsvMissing(payload))}>CSV (missing)</button>
          <button className="ghost-button" type="button" onClick={() => download("outliers.csv", "text/csv", exportCsvOutliers(payload))}>CSV (outliers)</button>
          <button className="ghost-button" type="button" onClick={() => download("control-comparisons.csv", "text/csv", exportCsvControlComparisons(payload))} disabled={!payload.controlComparisons.length}>CSV (controls)</button>
          <button className="ghost-button" type="button" onClick={() => download("descriptive-stats_report.json", "application/json", exportJson(payload))}>JSON</button>
          <button className="ghost-button" type="button" onClick={() => download("descriptive-stats_report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", exportExcel(payload, { methodsText, resultsText }))}>Excel</button>
          <button className="ghost-button" type="button" onClick={() => download("descriptive-stats_report.pdf", "application/pdf", exportPdf(payload))}>PDF</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Methods text</div>
          <textarea className="input" style={{ width: "100%", minHeight: 120 }} value={methodsText} onChange={(e) => setMethodsText(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="ghost-button" type="button" onClick={() => navigator.clipboard?.writeText(methodsText)}>Copy methods</button>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Results text</div>
          <textarea className="input" style={{ width: "100%", minHeight: 120 }} value={resultsText} onChange={(e) => setResultsText(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="ghost-button" type="button" onClick={() => navigator.clipboard?.writeText(resultsText)}>Copy results</button>
          </div>
        </div>
      </div>
    </div>
  );
}
