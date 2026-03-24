import { ColumnGuesses } from "../../data/ingestion";
import { normalizeRows } from "./normalize";
import { applyReplicateHandling } from "./replicates";
import { buildMissingnessSummary, computeControlComparisons, summarizeByGroup, summarizeOverall } from "./summarize";
import { flagOutliers } from "./outliers";
import { buildRecommendations } from "./recommend";
import { buildInterpretation } from "./interpret";
import { AnalysisRow, DescriptiveResult, ReplicateMode } from "./types";

interface ComputeOptions {
  replicateMode: ReplicateMode;
  collapseTechnical: boolean;
  mapping: ColumnGuesses;
  missingTokens: string[];
  audit: {
    sourceType: string;
    inferredStructure: string;
    notes: string[];
  };
  controlGroup?: string;
}

export function computeDescriptiveStats(
  rows: Record<string, unknown>[],
  options: ComputeOptions
): { result: DescriptiveResult; warnings: string[] } {
  const { mapping, missingTokens, replicateMode, collapseTechnical, controlGroup } = options;
  const normalization = normalizeRows(rows, mapping, missingTokens);
  const normalizedRows = normalization.normalized;

  const replicateHandled = applyReplicateHandling(normalizedRows, replicateMode, collapseTechnical);
  const analysisRows = replicateHandled.analysisRows;

  const overall = summarizeOverall(analysisRows);
  const byGroup = summarizeByGroup(analysisRows);
  const missingness = buildMissingnessSummary(analysisRows);
  const outliers = flagOutliers(analysisRows);

  // attach outliers to group summaries
  const outliersByGroup = outliers.reduce<Record<string, number>>((acc, o) => {
    const key = o.group ?? "(unlabeled)";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const byGroupWithOutliers = byGroup.map((g) => ({
    ...g,
    outliers: outliers.filter((o) => (o.group ?? "(unlabeled)") === (g.group ?? "(unlabeled)")),
  }));

  const controlComparisons = computeControlComparisons(byGroupWithOutliers, controlGroup);
  const recommendations = buildRecommendations(overall, byGroupWithOutliers, replicateMode, collapseTechnical);

  const warnings: string[] = [
    ...normalization.warnings,
    ...replicateHandled.warnings,
    ...overall.stats.warnings,
    ...byGroupWithOutliers.flatMap((g) => g.stats.warnings),
  ];

  const interpretation = buildInterpretation({
    audit: {
      sourceType: options.audit.sourceType,
      inferredStructure: options.audit.inferredStructure,
      mapping,
      replicateMode,
      collapseTechnical,
      missingTokens,
      notes: options.audit.notes,
      transformation: [],
    },
    normalizedRows,
    analysisRows: analysisRows as AnalysisRow[],
    overall: overall,
    byGroup: byGroupWithOutliers,
    replicateSummary: byGroupWithOutliers,
    missingness,
    outliers,
    controlComparisons,
    recommendations,
    warnings,
    metrics: {
      totalRows: normalizedRows.length,
      usableResponseRows: analysisRows.filter((r) => r.response !== null).length,
      missingResponse: normalizedRows.filter((r) => r.isMissingResponse).length,
      groups: byGroupWithOutliers.filter((g) => g.group).length,
      bioRepCount: replicateHandled.bioRepCount,
      techRepCount: replicateHandled.techRepCount,
    },
  });

  const result: DescriptiveResult = {
    audit: {
      sourceType: options.audit.sourceType,
      inferredStructure: options.audit.inferredStructure,
      mapping,
      replicateMode,
      collapseTechnical,
      missingTokens,
      notes: options.audit.notes,
      transformation: [],
    },
    normalizedRows,
    analysisRows: analysisRows as AnalysisRow[],
    overall: overall,
    byGroup: byGroupWithOutliers,
    replicateSummary: byGroupWithOutliers,
    missingness,
    outliers,
    controlComparisons,
    recommendations,
    warnings,
    metrics: {
      totalRows: normalizedRows.length,
      usableResponseRows: analysisRows.filter((r) => r.response !== null).length,
      missingResponse: normalizedRows.filter((r) => r.isMissingResponse).length,
      groups: byGroupWithOutliers.filter((g) => g.group).length,
      bioRepCount: replicateHandled.bioRepCount,
      techRepCount: replicateHandled.techRepCount,
    },
    interpretation,
  };

  return { result, warnings };
}
