import { AnalysisRow, ControlComparison, GroupSummary, MissingnessSummary, SummaryStats } from "./types";

function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function computeStats(values: number[], totalCount: number, missingCount: number): SummaryStats {
  const warnings: string[] = [];
  const n = totalCount;
  const nonMissingCount = values.length;
  const missing = missingCount;

  if (!nonMissingCount) {
    return {
      n,
      nonMissingCount,
      missingCount: missing,
      mean: null,
      median: null,
      mode: null,
      geometricMean: null,
      trimmedMean: null,
      sd: null,
      variance: null,
      sem: null,
      cvPercent: null,
      min: null,
      max: null,
      range: null,
      q1: null,
      q3: null,
      iqr: null,
      mad: null,
      skewness: null,
      kurtosis: null,
      ci95: null,
      warnings,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / nonMissingCount;
  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q1 !== null && q3 !== null ? q3 - q1 : null;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;

  // mode
  const freq: Record<string, number> = {};
  let maxFreq = 0;
  values.forEach((v) => {
    const key = v.toString();
    freq[key] = (freq[key] || 0) + 1;
    if (freq[key] > maxFreq) maxFreq = freq[key];
  });
  const modes = Object.entries(freq)
    .filter(([, count]) => count === maxFreq)
    .map(([val]) => Number(val));
  const mode = modes.length === values.length ? null : modes; // no mode if all equally frequent

  const deviations = values.map((v) => v - mean);
  const variance = nonMissingCount > 1 ? deviations.reduce((a, b) => a + b * b, 0) / (nonMissingCount - 1) : null;
  const sd = variance !== null ? Math.sqrt(variance) : null;
  const sem = sd !== null && nonMissingCount > 1 ? sd / Math.sqrt(nonMissingCount) : null;
  if (sem === null && nonMissingCount < 2) warnings.push("SEM not computed: n < 2.");

  const cvPercent = mean !== 0 ? (sd !== null ? (sd / Math.abs(mean)) * 100 : null) : null;

  const absDeviations = values.map((v) => Math.abs(v - (median ?? mean)));
  const mad = quantile(absDeviations.sort((a, b) => a - b), 0.5);

  // skewness and kurtosis (Fisher)
  let skewness: number | null = null;
  let kurtosis: number | null = null;
  if (sd !== null && sd !== 0 && nonMissingCount > 2) {
    const m3 = deviations.reduce((a, b) => a + Math.pow(b, 3), 0) / nonMissingCount;
    const m4 = deviations.reduce((a, b) => a + Math.pow(b, 4), 0) / nonMissingCount;
    skewness = m3 / Math.pow(sd, 3);
    kurtosis = m4 / Math.pow(sd, 4) - 3;
  }

  let geometricMean: number | null = null;
  if (values.every((v) => v > 0)) {
    const logMean = values.reduce((a, b) => a + Math.log(b), 0) / nonMissingCount;
    geometricMean = Math.exp(logMean);
  }

  let trimmedMean: number | null = null;
  if (nonMissingCount >= 5) {
    const trim = Math.floor(nonMissingCount * 0.1);
    const trimmed = sorted.slice(trim, sorted.length - trim);
    if (trimmed.length) trimmedMean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }

  let ci95: { lower: number; upper: number } | null = null;
  if (sem !== null) {
    const margin = 1.96 * sem;
    ci95 = { lower: mean - margin, upper: mean + margin };
  }

  return {
    n,
    nonMissingCount,
    missingCount: missing,
    mean,
    median,
    mode,
    geometricMean,
    trimmedMean,
    sd,
    variance,
    sem,
    cvPercent,
    min,
    max,
    range,
    q1,
    q3,
    iqr,
    mad,
    skewness,
    kurtosis,
    ci95,
    warnings,
  };
}

export function summarizeOverall(rows: AnalysisRow[]): GroupSummary {
  const values = rows.filter((r) => r.response !== null).map((r) => r.response as number);
  const missing = rows.length - values.length;
  return {
    group: null,
    stats: computeStats(values, rows.length, missing),
    missing: { missing, total: rows.length },
    outliers: [],
  };
}

export function summarizeByGroup(rows: AnalysisRow[]): GroupSummary[] {
  const groups = new Map<string, AnalysisRow[]>();
  rows.forEach((r) => {
    const key = r.group ?? "(unlabeled)";
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  });

  return Array.from(groups.entries()).map(([group, groupRows]) => {
    const values = groupRows.filter((r) => r.response !== null).map((r) => r.response as number);
    const missing = groupRows.length - values.length;
    return {
      group,
      stats: computeStats(values, groupRows.length, missing),
      missing: { missing, total: groupRows.length },
      outliers: [],
    };
  });
}

export function buildMissingnessSummary(rows: AnalysisRow[]): MissingnessSummary {
  const overallTotal = rows.length;
  const overallMissing = rows.filter((r) => r.response === null).length;
  const byGroup: Record<string, { missing: number; total: number }> = {};
  rows.forEach((r) => {
    const key = r.group ?? "(unlabeled)";
    if (!byGroup[key]) byGroup[key] = { missing: 0, total: 0 };
    byGroup[key].total += 1;
    if (r.response === null) byGroup[key].missing += 1;
  });
  return { overallMissing, overallTotal, byGroup };
}

export function computeControlComparisons(
  summaries: GroupSummary[],
  controlGroup?: string
): ControlComparison[] {
  if (!controlGroup) return [];
  const control = summaries.find((g) => g.group === controlGroup);
  if (!control || control.stats.mean === null) return [];
  const controlMean = control.stats.mean;
  const results: ControlComparison[] = [];
  summaries.forEach((g) => {
    if (g.group === controlGroup) return;
    const warnings: string[] = [];
    if (controlMean === 0 || Math.abs(controlMean) < 1e-9) {
      warnings.push("Control mean near zero; fold change unstable.");
    }
    const mean = g.stats.mean;
    const foldChange = mean !== null && controlMean !== 0 ? mean / controlMean : null;
    const percentChange = foldChange !== null ? (foldChange - 1) * 100 : null;
    const log2FoldChange = foldChange !== null && foldChange > 0 ? Math.log2(foldChange) : null;
    results.push({
      group: g.group || "(unlabeled)",
      controlGroup,
      foldChange,
      percentChange,
      log2FoldChange,
      warnings,
    });
  });
  return results;
}
