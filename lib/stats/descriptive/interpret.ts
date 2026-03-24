import { ControlComparison, DescriptiveResult, GroupSummary, ReplicateMode } from "./types";

export interface InterpretationBlock {
  title: string;
  detail: string;
}

function describeVariability(group: GroupSummary): string[] {
  const notes: string[] = [];
  const cv = group.stats.cvPercent;
  if (cv !== null) {
    if (cv < 10) notes.push(`${group.group ?? "Overall"} shows relatively low variability (CV ${cv.toFixed(1)}%).`);
    else if (cv > 30) notes.push(`${group.group ?? "Overall"} shows high variability (CV ${cv.toFixed(1)}%).`);
  }
  if (group.stats.sd === 0) notes.push(`${group.group ?? "Overall"} values are identical; spread metrics collapse.`);
  return notes;
}

function describeSkew(group: GroupSummary): string[] {
  const notes: string[] = [];
  const skew = group.stats.skewness;
  if (skew === null) return notes;
  if (Math.abs(skew) > 0.75) {
    notes.push(`${group.group ?? "Overall"} distribution is skewed; median and IQR may better represent the data.`);
  } else {
    notes.push(`${group.group ?? "Overall"} appears approximately symmetric; mean ± SD may be reasonable.`);
  }
  return notes;
}

function describeOutliers(group: GroupSummary): string[] {
  if (!group.outliers?.length) return [];
  return [`${group.group ?? "Overall"} has ${group.outliers.length} flagged outlier(s) (not removed). Inspect for assay issues or true biology.`];
}

function describeMissing(group: GroupSummary): string[] {
  const missing = group.missing.missing;
  const total = group.missing.total;
  if (!total) return [];
  const pct = (missing / total) * 100;
  if (pct === 0) return [];
  if (pct > 20) return [`${group.group ?? "Overall"} has ${pct.toFixed(1)}% missing responses; interpret cautiously.`];
  return [`${group.group ?? "Overall"} missing responses: ${pct.toFixed(1)}%.`];
}

function describeReplicates(mode: ReplicateMode, collapseTechnical: boolean, bioCount: number, techCount: number): string[] {
  const notes: string[] = [];
  if (mode === "nested") {
    if (collapseTechnical) {
      notes.push(`Nested replicates: technical replicates averaged within biological replicates before summarizing (biological n = ${bioCount}).`);
    } else {
      notes.push(`Nested replicates: technical replicates shown; they are not biological n. Biological n = ${bioCount}, technical rows = ${techCount}.`);
    }
  } else if (mode === "technical") {
    notes.push(`Technical-only replicates; biological inference is limited without biological IDs (technical rows = ${techCount}).`);
  } else if (mode === "biological") {
    notes.push(`Biological-level summaries (n = ${bioCount}); technical replicates, if present, are treated within biological IDs.`);
  }
  return notes;
}

function describeControlComparisons(comparisons: ControlComparison[]): string[] {
  return comparisons.flatMap((c) => {
    const pieces: string[] = [];
    if (c.warnings.length) pieces.push(`${c.group} vs ${c.controlGroup}: ${c.warnings.join("; ")}`);
    if (c.foldChange !== null) pieces.push(`${c.group} vs ${c.controlGroup}: fold change ${c.foldChange.toFixed(2)} (${c.percentChange !== null ? c.percentChange.toFixed(1) + "%" : "n/a"}).`);
    return pieces;
  });
}

export function buildInterpretation(result: DescriptiveResult): InterpretationBlock[] {
  const blocks: InterpretationBlock[] = [];

  // Variability + skew per group (limit to keep concise)
  result.byGroup.forEach((g) => {
    const details = [
      ...describeVariability(g),
      ...describeSkew(g),
      ...describeOutliers(g),
      ...describeMissing(g),
    ];
    if (g.stats.nonMissingCount <= 1) details.push("Only one usable observation; spread metrics are limited.");
    if (g.stats.sd === 0 && g.stats.nonMissingCount > 1) details.push("Values are identical; spread metrics collapse.");
    if (details.length) {
      blocks.push({ title: g.group ?? "Overall", detail: details.join(" ") });
    }
  });

  // Replicates
  const repNotes = describeReplicates(result.audit.replicateMode, result.audit.collapseTechnical, result.metrics.bioRepCount, result.metrics.techRepCount);
  if (repNotes.length) blocks.push({ title: "Replicates", detail: repNotes.join(" ") });

  // Control comparisons
  const cc = describeControlComparisons(result.controlComparisons);
  cc.forEach((c) => blocks.push({ title: "Control comparison", detail: c }));

  // General recommendations already computed
  result.recommendations.forEach((r) => blocks.push({ title: r.title, detail: r.detail }));

  // Small n or identical values
  if (result.overall.stats.nonMissingCount <= 1) {
    blocks.push({ title: "Small n", detail: "Only one usable observation; variability metrics are not interpretable." });
  }
  if (result.overall.stats.sd === 0 && result.overall.stats.nonMissingCount > 1) {
    blocks.push({ title: "Zero variance", detail: "All values identical; spread metrics collapse." });
  }

  return blocks;
}
