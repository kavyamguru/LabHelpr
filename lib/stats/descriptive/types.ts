import { ColumnGuesses } from "../../data/ingestion";

export type ReplicateMode = "none" | "technical" | "biological" | "nested";

export interface NormalizedRow {
  sampleId: string | null;
  response: number | null;
  group: string | null;
  condition: string | null;
  dose: number | string | null;
  timepoint: number | string | null;
  bioRep: string | null;
  techRep: string | null;
  batch: string | null;
  plate: string | null;
  well: string | null;
  cellLine: string | null;
  genotype: string | null;
  units: string | null;
  controlFlag: string | null;
  rawRowIndex: number;
  isMissingResponse: boolean;
  additional?: Record<string, unknown>;
}

export interface AnalysisRow extends NormalizedRow {
  // response may be aggregated if collapse-tech is applied
  sourceRows?: number[]; // indices from normalized rows contributing
}

export interface MissingnessSummary {
  overallMissing: number;
  overallTotal: number;
  byGroup: Record<string, { missing: number; total: number }>;
}

export interface OutlierFlag {
  rowIndex: number;
  group: string | null;
  value: number;
  method: "iqr" | "z-score";
  threshold?: number;
}

export interface SummaryStats {
  n: number;
  nonMissingCount: number;
  missingCount: number;
  mean: number | null;
  median: number | null;
  mode: number[] | null;
  geometricMean: number | null;
  trimmedMean?: number | null;
  sd: number | null;
  variance: number | null;
  sem: number | null;
  cvPercent: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  mad: number | null;
  skewness: number | null;
  kurtosis: number | null;
  ci95: { lower: number; upper: number } | null;
  warnings: string[];
}

export interface GroupSummary {
  group: string | null;
  stats: SummaryStats;
  missing: { missing: number; total: number };
  outliers: OutlierFlag[];
}

export interface ControlComparison {
  group: string;
  controlGroup: string;
  foldChange: number | null;
  percentChange: number | null;
  log2FoldChange: number | null;
  warnings: string[];
}

export interface Recommendation {
  title: string;
  detail: string;
}

export interface DescriptiveResult {
  audit: {
    sourceType: string;
    inferredStructure: string;
    mapping: ColumnGuesses;
    replicateMode: ReplicateMode;
    collapseTechnical: boolean;
    missingTokens: string[];
    notes: string[];
    transformation?: string[];
  };
  normalizedRows: NormalizedRow[];
  analysisRows: AnalysisRow[];
  overall: GroupSummary;
  byGroup: GroupSummary[];
  replicateSummary: GroupSummary[];
  missingness: MissingnessSummary;
  outliers: OutlierFlag[];
  controlComparisons: ControlComparison[];
  recommendations: Recommendation[];
  interpretation?: { title: string; detail: string }[];
  warnings: string[];
  metrics: {
    totalRows: number;
    usableResponseRows: number;
    missingResponse: number;
    groups: number;
    bioRepCount: number;
    techRepCount: number;
  };
}
