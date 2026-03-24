import * as XLSX from "xlsx";
import { ExportPayload } from "./exportTypes";

function addSheet(wb: XLSX.WorkBook, name: string, rows: Array<Record<string, any>>) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

export function exportExcel(payload: ExportPayload, opts?: { methodsText?: string; resultsText?: string }): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const auditMeta = {
    timestamp: payload.timestamp,
    feature: payload.feature,
    sourceType: payload.audit.sourceType,
    structure: payload.audit.inferredStructure,
    units: payload.units ?? "",
    replicateMode: payload.audit.replicateMode,
    collapseTechnical: payload.audit.collapseTechnical,
    controlGroup: payload.controlGroup ?? "",
    totalRows: payload.metrics.totalRows,
    usableResponses: payload.metrics.usableResponseRows,
    missingResponses: payload.metrics.missingResponse,
    bioRepCount: payload.metrics.bioRepCount,
    techRepCount: payload.metrics.techRepCount,
  };

  addSheet(wb, "Dataset_overview", [auditMeta]);

  const mappingRows = Object.entries(payload.mapping).map(([role, col]) => ({ role, column: col ?? "" }));
  addSheet(wb, "Column_mapping", mappingRows.length ? mappingRows : [{ note: "No mapping detected" }]);

  addSheet(wb, "Replicates", [
    {
      replicateMode: payload.audit.replicateMode,
      collapseTechnical: payload.audit.collapseTechnical,
      controlGroup: payload.controlGroup ?? "",
      missingTokens: (payload.audit.missingTokens || []).join(", "),
    },
  ]);

  addSheet(wb, "Summary_overall", [{ group: "Overall", ...payload.overall.stats }]);

  const byGroupRows = payload.byGroup.map((g) => ({ group: g.group ?? "(unlabeled)", ...g.stats }));
  addSheet(wb, "Summary_by_group", byGroupRows);

  const missRows = Object.entries(payload.missingness.byGroup).map(([g, v]) => ({ group: g, missing: v.missing, total: v.total }));
  missRows.unshift({ group: "Overall", missing: payload.missingness.overallMissing, total: payload.missingness.overallTotal });
  addSheet(wb, "Missingness", missRows);

  addSheet(wb, "Outliers", payload.outliers.map((o) => ({ rowIndex: o.rowIndex, group: o.group ?? "(unlabeled)", value: o.value, method: o.method })));

  addSheet(wb, "Control_comparisons", payload.controlComparisons.map((c) => ({ group: c.group, control: c.controlGroup, foldChange: c.foldChange, percentChange: c.percentChange, log2FoldChange: c.log2FoldChange, warnings: c.warnings.join("; ") })));

  if (payload.interpretation) {
    addSheet(wb, "Interpretation", payload.interpretation.map((i) => ({ title: i.title, detail: i.detail })));
  }

  addSheet(wb, "Warnings", payload.warnings.length ? payload.warnings.map((w) => ({ warning: w })) : [{ warning: "None" }]);
  addSheet(wb, "Recommendations", payload.recommendations.length ? payload.recommendations.map((r) => ({ title: r.title, detail: r.detail })) : [{ title: "None", detail: "" }]);

  addSheet(wb, "Methods_text", [{ methods: opts?.methodsText ?? "" }]);
  addSheet(wb, "Results_text", [{ results: opts?.resultsText ?? "" }]);

  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
