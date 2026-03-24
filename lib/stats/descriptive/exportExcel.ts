import * as XLSX from "xlsx";
import { ExportPayload } from "./exportTypes";

function addSheet(wb: XLSX.WorkBook, name: string, rows: Array<Record<string, any>>) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export function exportExcel(payload: ExportPayload, opts?: { methodsText?: string; resultsText?: string }): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // 1. Dataset overview
  addSheet(wb, "Dataset overview", [
    {
      timestamp: payload.timestamp,
      feature: payload.feature,
      sourceType: payload.audit.sourceType,
      structure: payload.audit.inferredStructure,
      units: payload.units ?? "",
      totalRows: payload.metrics.totalRows,
      usableResponses: payload.metrics.usableResponseRows,
      missingResponses: payload.metrics.missingResponse,
    },
  ]);

  // 2. Column mapping
  const mappingRows = Object.entries(payload.mapping).map(([role, col]) => ({ role, column: col ?? "" }));
  addSheet(wb, "Column mapping", mappingRows.length ? mappingRows : [{ note: "No mapping detected" }]);

  // 3. Replicate setup
  addSheet(wb, "Replicate setup", [
    {
      replicateMode: payload.audit.replicateMode,
      collapseTechnical: payload.audit.collapseTechnical,
      controlGroup: payload.controlGroup ?? "",
      missingTokens: (payload.audit.missingTokens || []).join(", "),
    },
  ]);

  // 4. Overall summary
  addSheet(wb, "Overall summary", [{ group: "Overall", ...payload.overall.stats }]);

  // 5. Per-group summary
  const byGroupRows = payload.byGroup.map((g) => ({ group: g.group ?? "(unlabeled)", ...g.stats }));
  addSheet(wb, "Per-group summary", byGroupRows);

  // 6. Missingness
  const missRows = Object.entries(payload.missingness.byGroup).map(([g, v]) => ({ group: g, missing: v.missing, total: v.total }));
  missRows.unshift({ group: "Overall", missing: payload.missingness.overallMissing, total: payload.missingness.overallTotal });
  addSheet(wb, "Missingness", missRows);

  // 7. Outliers
  addSheet(wb, "Outliers", payload.outliers.map((o) => ({ rowIndex: o.rowIndex, group: o.group ?? "(unlabeled)", value: o.value, method: o.method })));

  // 8. Control comparisons
  if (payload.controlComparisons.length) {
    addSheet(wb, "Control comparisons", payload.controlComparisons.map((c) => ({ group: c.group, control: c.controlGroup, foldChange: c.foldChange, percentChange: c.percentChange, log2FoldChange: c.log2FoldChange, warnings: c.warnings.join("; ") })));
  }

  // 9. Methods text
  addSheet(wb, "Methods text", [{ methods: opts?.methodsText ?? "" }]);

  // 10. Results text
  addSheet(wb, "Results text", [{ results: opts?.resultsText ?? "" }]);

  // 11. Interpretation
  if (payload.interpretation) {
    addSheet(wb, "Interpretation", payload.interpretation.map((i) => ({ title: i.title, detail: i.detail })));
  }

  // 12. Warnings/Recommendations
  addSheet(wb, "Warnings", payload.warnings.map((w) => ({ warning: w })));
  addSheet(wb, "Recommendations", payload.recommendations.map((r) => ({ title: r.title, detail: r.detail })));

  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
