import { ExportPayload } from "./exportTypes";

function toCsv(rows: Array<Record<string, any>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push(headers.map((h) => formatCsv(r[h])).join(","));
  });
  return lines.join("\n");
}

function formatCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val).replace(/"/g, '""');
  if (s.includes(",") || s.includes("\n")) return `"${s}"`;
  return s;
}

export function exportCsvOverall(payload: ExportPayload): string {
  const rows = [{ group: "Overall", ...payload.overall.stats }];
  return toCsv(rows);
}

export function exportCsvByGroup(payload: ExportPayload): string {
  const rows = payload.byGroup.map((g) => ({ group: g.group ?? "(unlabeled)", ...g.stats }));
  return toCsv(rows);
}

export function exportCsvMissing(payload: ExportPayload): string {
  const rows = Object.entries(payload.missingness.byGroup).map(([g, v]) => ({ group: g, missing: v.missing, total: v.total }));
  rows.unshift({ group: "Overall", missing: payload.missingness.overallMissing, total: payload.missingness.overallTotal });
  return toCsv(rows);
}

export function exportCsvOutliers(payload: ExportPayload): string {
  const rows = payload.outliers.map((o) => ({ rowIndex: o.rowIndex, group: o.group ?? "(unlabeled)", value: o.value, method: o.method }));
  return toCsv(rows);
}

export function exportCsvControlComparisons(payload: ExportPayload): string {
  const rows = payload.controlComparisons.map((c) => ({ group: c.group, control: c.controlGroup, foldChange: c.foldChange, percentChange: c.percentChange, log2FoldChange: c.log2FoldChange, warnings: c.warnings.join("; ") }));
  return toCsv(rows);
}
