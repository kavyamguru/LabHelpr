import jsPDF from "jspdf";
import { ExportPayload } from "./exportTypes";

export function exportPdf(payload: ExportPayload): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 30;
  const addLine = (text: string, opts?: { bold?: boolean }) => {
    if (opts?.bold) doc.setFont(undefined, "bold"); else doc.setFont(undefined, "normal");
    doc.text(text, 40, y);
    y += 16;
  };

  addLine("Descriptive Statistics Report", { bold: true });
  addLine(`Timestamp: ${payload.timestamp}`);
  addLine(`Response units: ${payload.units ?? "n/a"}`);
  addLine(`Replicate mode: ${payload.audit.replicateMode}; collapse technical: ${payload.audit.collapseTechnical ? "yes" : "no"}`);
  addLine(`Control group: ${payload.controlGroup ?? "none"}`);
  y += 8;
  addLine("Dataset overview", { bold: true });
  addLine(`Total rows: ${payload.metrics.totalRows}; usable responses: ${payload.metrics.usableResponseRows}; missing responses: ${payload.metrics.missingResponse}`);
  addLine(`Original columns: ${(payload.audit.mapping && Object.values(payload.audit.mapping).filter(Boolean).length) || 0} mapped roles`);
  y += 8;
  addLine("Missingness", { bold: true });
  addLine(`Overall missing responses: ${payload.missingness.overallMissing}/${payload.missingness.overallTotal}`);
  y += 8;
  addLine("Descriptive summaries", { bold: true });
  payload.byGroup.slice(0, 6).forEach((g) => {
    addLine(`${g.group ?? "(unlabeled)"}: mean ${fmt(g.stats.mean)}, median ${fmt(g.stats.median)}, SD ${fmt(g.stats.sd)}, IQR ${fmt(g.stats.iqr)}, n=${g.stats.nonMissingCount}`);
  });
  if (payload.byGroup.length > 6) addLine("Additional groups omitted for brevity.");
  y += 8;
  if (payload.controlComparisons.length) {
    addLine("Control comparisons", { bold: true });
    payload.controlComparisons.forEach((c) => addLine(`${c.group} vs ${c.controlGroup}: fold ${fmt(c.foldChange)} (${fmt(c.percentChange)}%), warnings: ${c.warnings.join("; ")}`));
    y += 8;
  }
  addLine("Outliers", { bold: true });
  addLine(`Flagged (IQR) and not removed: ${payload.outliers.length}`);
  y += 8;
  addLine("Interpretation", { bold: true });
  (payload.interpretation || []).slice(0, 6).forEach((b) => addLine(`${b.title}: ${b.detail}`));
  if (payload.interpretation && payload.interpretation.length > 6) addLine("Additional interpretation omitted for brevity.");
  y += 8;
  addLine("Warnings", { bold: true });
  payload.warnings.slice(0, 8).forEach((w) => addLine(`- ${w}`));
  if (payload.warnings.length > 8) addLine("Additional warnings omitted for brevity.");
  y += 8;
  addLine("Notes", { bold: true });
  addLine("Technical replicates are not biological n. Outliers were flagged, not removed. Missing values excluded per-metric.");
  addLine("This report is descriptive, not inferential.");

  return doc.output("arraybuffer") as Uint8Array;
}

function fmt(v: any): string {
  if (v === null || v === undefined) return "n/a";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(3) : "n/a";
  return String(v);
}
