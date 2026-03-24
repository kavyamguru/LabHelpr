import { DescriptiveResult } from "./types";

export interface ExportPayload {
  timestamp: string;
  feature: string;
  filenameBase?: string;
  version?: string;
  audit: DescriptiveResult["audit"];
  mapping: DescriptiveResult["audit"]["mapping"];
  controlGroup?: string;
  units?: string | null;
  metrics: DescriptiveResult["metrics"];
  missingness: DescriptiveResult["missingness"];
  warnings: string[];
  recommendations: DescriptiveResult["recommendations"];
  interpretation: DescriptiveResult["interpretation"];
  overall: DescriptiveResult["overall"];
  byGroup: DescriptiveResult["byGroup"];
  replicateSummary: DescriptiveResult["replicateSummary"];
  outliers: DescriptiveResult["outliers"];
  controlComparisons: DescriptiveResult["controlComparisons"];
  plots: {
    histogram: boolean;
    strip: boolean;
    qq: boolean;
    bioTech: boolean;
  };
}
