import { ControlComparison, DescriptiveResult, GroupSummary, ReplicateMode } from "./types";

export interface InterpretationBlock {
  title: string;
  detail: string;
}

function describeVariability(group: GroupSummary): string[] {
  const notes: string[] = [];
  const cv = group.stats.cvPercent;
  if (cv !== null) {
    if (cv < 10) notes.push(`${group.group ?? "Overall"}: low variability (CV ${cv.toFixed(1)}%).`);
    else if (cv > 30) notes.push(`${group.group ?? "Overall"}: high variability (CV ${cv.toFixed(1)}%).`);
    else notes.push(`${group.group ?? "Overall"}: moderate variability (CV ${cv.toFixed(1)}%).`);
  }
  if (group.stats.sd === 0 && group.stats.nonMissingCount > 1) {
    notes.push(`${group.group ?? "Overall"}: values are identical; spread metrics collapse.`);
  }
  return notes;
}

function describeSkew(group: GroupSummary): string[] {
  const notes: string[] = [];
  const skew = group.stats.skewness;
  if (skew === null) return notes;
  if (Math.abs(skew) > 0.75) {
    notes.push(`${group.group ?? "Overall"}: skewed distribution; prefer median/IQR over mean/SD.`);
  } else {
    notes.push(`${group.group ?? "Overall"}: approximately symmetric; mean ± SD reasonable.`);
  }
  return notes;
}

function describeOutliers(group: GroupSummary): string[] {
  if (!group.outliers?.length) return [];
  return [`${group.group ?? "Overall"}: ${group.outliers.length} outlier(s) flagged (not removed). Inspect for assay issues or true biology.`];
}

function describeMissing(group: GroupSummary): string[] {
  const missing = group.missing.missing;
  const total = group.missing.total;
  if (!total) return [];
  const pct = (missing / total) * 100;
  if (pct === 0) return [];
  if (pct > 20) return [`${group.group ?? "Overall"}: ${pct.toFixed(1)}% missing; reliability reduced.`];
  return [`${group.group ?? "Overall"}: missing ${pct.toFixed(1)}%.`];
}

function describeReplicates(mode: ReplicateMode, collapseTechnical: boolean, bioCount: number, techCount: number): string[] {
  const notes: string[] = [];
  if (mode === "nested") {
    if (collapseTechnical) notes.push(`Nested replicates: technical replicates averaged within biological replicates (bio n = ${bioCount}).`);
    else notes.push(`Nested replicates: technical replicates displayed (not biological n). Bio n = ${bioCount}, tech rows = ${techCount}.`);
  } else if (mode === "technical") {
    notes.push(`Technical-only replicate IDs; biological inference limited (tech rows = ${techCount}).`);
  } else if (mode === "biological") {
    notes.push(`Biological-level summaries (bio n = ${bioCount}); technical reps, if present, handled within bio IDs.`);
  } else if (mode === "none") {
    notes.push(`No replicate IDs; each row treated independently.`);
  }
  return notes;
}

function describeControlComparisons(comparisons: ControlComparison[]): string[] {
  return comparisons.flatMap((c) => {
    const parts: string[] = [];
    if (c.warnings.length) parts.push(`${c.group} vs ${c.controlGroup}: ${c.warnings.join("; ")}`);
    if (c.foldChange !== null || c.percentChange !== null || c.log2FoldChange !== null) {
      parts.push(`${c.group} vs ${c.controlGroup}: fold ${c.foldChange ?? "-"}, percent ${c.percentChange ?? "-"}, log2 ${c.log2FoldChange ?? "-"}.`);
    }
    return parts;
  });
}

function describeSmallN(group: GroupSummary): string[] {
  const notes: string[] = [];
  if (group.stats.nonMissingCount <= 1) notes.push(`${group.group ?? "Overall"}: only one usable observation; variability metrics limited.`);
  if (group.stats.nonMissingCount < 5) notes.push(`${group.group ?? "Overall"}: n < 5; interpret spread/shape cautiously.`);
  return notes;
}

export function buildInterpretation(result: DescriptiveResult): InterpretationBlock[] {
  const blocks: InterpretationBlock[] = [];

  // Per-group detail
  result.byGroup.forEach((g) => {
    const details = [
      ...describeVariability(g),
      ...describeSkew(g),
      ...describeOutliers(g),
      ...describeMissing(g),
      ...describeSmallN(g),
    ];
    if (details.length) {
      blocks.push({ title: g.group ?? "Overall", detail: details.join(" ") });
    }
  });

  // Replicate handling
  const repNotes = describeReplicates(result.audit.replicateMode, result.audit.collapseTechnical, result.metrics.bioRepCount, result.metrics.techRepCount);
  if (repNotes.length) blocks.push({ title: "Replicates", detail: repNotes.join(" ") });
  if (!result.metrics.bioRepCount && result.audit.replicateMode !== "none") {
    blocks.push({ title: "Biological IDs missing", detail: "No biological replicate IDs detected; biological conclusions are limited." });
  }

  // Missingness overall
  const overallMissingPct = (result.overall.missing.missing / Math.max(result.overall.missing.total, 1)) * 100;
  if (overallMissingPct > 0) {
    blocks.push({ title: "Missingness", detail: `Overall missing responses: ${overallMissingPct.toFixed(1)}% (not dropped).` });
  }

  // Control comparisons
  const cc = describeControlComparisons(result.controlComparisons);
  cc.forEach((c) => blocks.push({ title: "Control comparison", detail: c }));

  // Recommendations precomputed
  result.recommendations.forEach((r) => blocks.push({ title: r.title, detail: r.detail }));

  // Zero variance / small n for overall
  if (result.overall.stats.nonMissingCount <= 1) {
    blocks.push({ title: "Small n", detail: "Only one usable observation; variability metrics are not interpretable." });
  }
  if (result.overall.stats.sd === 0 && result.overall.stats.nonMissingCount > 1) {
    blocks.push({ title: "Zero variance", detail: "All values identical; spread metrics collapse." });
  }

  return blocks;
}
