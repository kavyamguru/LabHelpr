import { ExportPayload } from "./exportTypes";

export function buildMethodsText(payload: ExportPayload): string {
  const mode = payload.audit.replicateMode;
  const collapse = payload.audit.collapseTechnical;
  const control = payload.controlGroup;
  const recs = payload.recommendations.map((r) => `${r.title}: ${r.detail}`).join(" ");

  const replicateSentence = mode === "nested"
    ? collapse
      ? "Technical replicates were averaged within each biological replicate before group-level summarization."
      : "Technical replicates were retained alongside biological replicates; technical n was not treated as biological n."
    : mode === "technical"
      ? "Only technical replicate identifiers were provided; biological inference is limited."
      : "Biological-level summaries were computed using provided biological replicate identifiers.";

  const controlSentence = control ? `Control comparisons were computed relative to '${control}'.` : "No control group was specified.";

  return [
    "Descriptive statistics were computed for the selected response variable.",
    "Continuous data were summarized as mean ± SD when distributions appeared approximately symmetric and as median (IQR) when skewed.",
    "Missing values were excluded per metric and reported separately.",
    "Potential outliers were flagged using the IQR rule and were not removed from primary summaries.",
    replicateSentence,
    controlSentence,
    recs ? `Reporting guidance: ${recs}` : "",
  ].filter(Boolean).join(" ");
}

export function buildResultsText(payload: ExportPayload): string {
  const pieces: string[] = [];
  const overall = payload.overall.stats;
  const groups = payload.byGroup;
  if (overall.nonMissingCount === 0) {
    pieces.push("No usable response values were available; results are descriptive only.");
  }
  if (groups.length === 1) {
    const g = groups[0];
    pieces.push(`${g.group ?? "Overall"} summary: mean ${fmt(g.stats.mean)} ± SD ${fmt(g.stats.sd)}; median ${fmt(g.stats.median)} (IQR ${fmt(g.stats.iqr)}). n=${g.stats.nonMissingCount}.`);
  } else {
    groups.slice(0, 3).forEach((g) => {
      pieces.push(`${g.group ?? "(unlabeled)"}: mean ${fmt(g.stats.mean)} ± SD ${fmt(g.stats.sd)}, median ${fmt(g.stats.median)}, IQR ${fmt(g.stats.iqr)}, n=${g.stats.nonMissingCount}.`);
    });
    if (groups.length > 3) pieces.push("Additional groups summarized in tables.");
  }
  if (payload.controlComparisons.length) {
    payload.controlComparisons.forEach((c) => {
      pieces.push(`${c.group} vs ${c.controlGroup}: fold change ${fmt(c.foldChange)} (${fmt(c.percentChange)}%). ${c.warnings.join(" ")}`);
    });
  }
  if (payload.outliers.length) pieces.push(`Outliers flagged (IQR) and not removed: ${payload.outliers.length}.`);
  pieces.push(`Replicate mode: ${payload.audit.replicateMode}; collapse technical: ${payload.audit.collapseTechnical ? "yes" : "no"}.`);
  return pieces.filter(Boolean).join(" ");
}

function fmt(v: any): string {
  if (v === null || v === undefined) return "n/a";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(3) : "n/a";
  return String(v);
}
