import { DescriptiveResult } from "./types";
import { ExportPayload } from "./exportTypes";

export function buildExportPayload(result: DescriptiveResult, opts?: { controlGroup?: string; units?: string | null; plots?: ExportPayload["plots"]; version?: string }): ExportPayload {
  return {
    timestamp: new Date().toISOString(),
    feature: "Descriptive Stats",
    version: opts?.version,
    audit: result.audit,
    mapping: result.audit.mapping,
    controlGroup: opts?.controlGroup,
    units: opts?.units ?? result.audit.mapping.units ?? null,
    metrics: result.metrics,
    missingness: result.missingness,
    warnings: result.warnings,
    recommendations: result.recommendations,
    interpretation: result.interpretation,
    overall: result.overall,
    byGroup: result.byGroup,
    replicateSummary: result.replicateSummary,
    outliers: result.outliers,
    controlComparisons: result.controlComparisons,
    plots: opts?.plots ?? { histogram: true, box: true, violin: true, strip: true, qq: true, bioTech: true },
  };
}
