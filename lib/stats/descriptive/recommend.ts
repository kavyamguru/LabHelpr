import { GroupSummary, Recommendation, ReplicateMode } from "./types";

function isSkewed(skewness: number | null): boolean {
  if (skewness === null) return false;
  return Math.abs(skewness) > 0.75;
}

export function buildRecommendations(
  overall: GroupSummary,
  byGroup: GroupSummary[],
  mode: ReplicateMode,
  collapseTechnical: boolean
): Recommendation[] {
  const recs: Recommendation[] = [];

  const skewed = overall.stats.skewness !== null && isSkewed(overall.stats.skewness);
  const n = overall.stats.nonMissingCount;

  if (skewed) {
    recs.push({
      title: "Skewed distribution",
      detail: "Median and IQR may better represent the data than mean ± SD." ,
    });
  } else {
    recs.push({
      title: "Approximately symmetric",
      detail: "Mean ± SD may be reasonable; still report n and missingness.",
    });
  }

  if (mode === "nested") {
    recs.push({
      title: collapseTechnical ? "Nested replicates collapsed" : "Nested replicates uncollapsed",
      detail: collapseTechnical
        ? "Reporting biological-level summaries; technical replicates averaged within each biological replicate."
        : "Technical replicates are not biological n; interpret with caution or collapse before reporting.",
    });
  } else if (mode === "technical") {
    recs.push({
      title: "Technical-only replicates",
      detail: "Biological inference is limited without biological IDs; avoid over-interpreting n.",
    });
  }

  if (n < 5) {
    recs.push({
      title: "Small sample size",
      detail: "Interpret estimates cautiously; SEM/CI may be unstable or unavailable.",
    });
  }

  const groups = byGroup.filter((g) => g.group).length;
  if (groups <= 1) {
    recs.push({
      title: "Single group",
      detail: "Focus on distribution shape and missingness; control comparisons are not applicable.",
    });
  }

  return recs;
}
