import { mean as ssMean, median as ssMedian, variance as ssVariance, sampleVariance, quantileSorted } from "simple-statistics";
import { studentt } from "jstat";

export type ReplicateType = "biological" | "technical";
export type TechnicalHandling = "average" | "separate";
export type MissingHandling = "ignore" | "drop-replicate";
export type Transform = "none" | "log2" | "log10";
export type VarianceConvention = "sample" | "population";
export type NormalityLabel = "looks roughly normal" | "possibly non-normal" | "not reliable";

export interface RawRow {
  rowId: number;
  group: string;
  bioRep?: string;
  techRep?: string;
  value?: number;
  unit?: string;
  rawValue: string;
  issues: string[];
}

export interface GroupStats {
  group: string;
  nBio: number;
  nTech: number;
  mean: number;
  median: number;
  modes: number[];
  sd: number;
  variance: number;
  sem: number;
  cv: number;
  min: number;
  max: number;
  range: number;
  ci95: { low: number; high: number; df: number } | null;
  normality: { w: number | null; label: NormalityLabel };
  iqrFlags: { low: number; high: number; count: number; indices: number[] };
  valuesUsed: number[];
  iqrMultiplier: number;
}

export interface FoldChange {
  group: string;
  reference: string;
  percentChange: number;
  foldChange: number;
  log2FoldChange: number | null;
}

export interface ComputeOptions {
  replicateType: ReplicateType;
  technicalHandling: TechnicalHandling;
  missingHandling: MissingHandling;
  transform: Transform;
  allowNonPositiveLog: boolean;
  varianceConvention: VarianceConvention;
  iqrMultiplier: number;
  ciMethod: "t95" | "none";
}

export interface ComputeResult {
  stats: GroupStats[];
  warnings: string[];
}

export function multiMode(values: number[]): number[] {
  if (values.length === 0) return [];
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const maxCount = Math.max(...Array.from(counts.values()));
  if (maxCount <= 1) return [];
  return Array.from(counts.entries())
    .filter(([, c]) => c === maxCount)
    .map(([v]) => v)
    .sort((a, b) => a - b);
}

export function applyTransform(values: number[], transform: Transform, allowNonPositive: boolean) {
  if (transform === "none") return { values, warning: null as string | null, excluded: [] as number[] };
  const excluded: number[] = [];
  const transformed: number[] = [];
  values.forEach((v) => {
    if (v <= 0) {
      excluded.push(v);
      if (!allowNonPositive) return;
    }
    if (v > 0 || allowNonPositive) {
      if (transform === "log2") transformed.push(Math.log2(v));
      if (transform === "log10") transformed.push(Math.log10(v));
    }
  });
  const warning = excluded.length > 0 ? "Log transformation applied; zero/negative values excluded or adjusted." : null;
  return { values: transformed, warning, excluded };
}

function classifyNormality(w: number | null, n: number): NormalityLabel {
  if (!w || n < 3) return "not reliable";
  if (w >= 0.97) return "looks roughly normal";
  if (w >= 0.9) return "possibly non-normal";
  return "possibly non-normal";
}

function approxShapiro(values: number[]): { W: number; label: NormalityLabel } | null {
  if (values.length < 3) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = ssMean(sorted);
  const ss = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  if (ss === 0) return { W: 1, label: "looks roughly normal" };
  const m = sorted.map((_, i) => {
    const p = (i + 1 - 0.375) / (n + 0.25);
    return inverseNormal(p);
  });
  const denom = Math.sqrt(m.reduce((acc, v) => acc + v * v, 0));
  const a = m.map((v) => v / denom);
  const b = a.reduce((acc, ai, idx) => acc + ai * sorted[idx], 0);
  const W = (b * b) / ss;
  return { W, label: classifyNormality(W, n) };
}

function inverseNormal(p: number) {
  const a1 = -39.6968302866538;
  const a2 = 220.946098424521;
  const a3 = -275.928510446969;
  const a4 = 138.357751867269;
  const a5 = -30.6647980661472;
  const a6 = 2.50662827745924;

  const b1 = -54.4760987982241;
  const b2 = 161.585836858041;
  const b3 = -155.698979859887;
  const b4 = 66.8013118877197;
  const b5 = -13.2806815528857;

  const c1 = -7.78489400243029e-03;
  const c2 = -0.322396458041136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;

  const d1 = 7.78469570904146e-03;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  const plow = 0.02425;
  const phigh = 1 - plow;

  let q = 0;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  if (phigh < p) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  q = p - 0.5;
  const r = q * q;
  return (
    (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
}

export function computeGroupStats(rows: RawRow[], options: ComputeOptions): ComputeResult {
  const { replicateType, technicalHandling, transform, allowNonPositiveLog, varianceConvention, iqrMultiplier, ciMethod } = options;
  const groups = Array.from(new Set(rows.map((r) => r.group || "Ungrouped")));
  const warnings: string[] = [];
  const results: GroupStats[] = [];

  groups.forEach((group) => {
    const inGroup = rows.filter((r) => (r.group || "Ungrouped") === group);
    if (inGroup.length === 0) return;

    const bioKeys = new Set(inGroup.map((r) => r.bioRep || `bio-${r.rowId}`));
    const nBio = bioKeys.size;
    const nTech = inGroup.filter((r) => r.techRep !== undefined).length;

    let values: number[] = [];
    if (replicateType === "biological") {
      values = inGroup.map((r) => r.value!).filter((v) => Number.isFinite(v));
    } else {
      const groupedByBio = inGroup.reduce<Record<string, number[]>>((acc, row) => {
        const key = row.bioRep || `bio-${row.rowId}`;
        acc[key] = acc[key] || [];
        if (row.value !== undefined) acc[key].push(row.value);
        return acc;
      }, {});
      if (technicalHandling === "average") {
        values = Object.values(groupedByBio)
          .filter((arr) => arr.length > 0)
          .map((arr) => ssMean(arr));
      } else {
        values = Object.values(groupedByBio).flat();
      }
    }

    const { values: transformed, warning, excluded } = applyTransform(values, transform, allowNonPositiveLog);
    if (warning) warnings.push(warning);
    if (excluded.length > 0 && transform !== "none" && !allowNonPositiveLog) warnings.push(`Excluded ${excluded.length} non-positive value(s) from log transform.`);
    if (transformed.length === 0) return;

    const sorted = [...transformed].sort((a, b) => a - b);
    const modes = multiMode(sorted);
    const varianceFn = varianceConvention === "sample" ? sampleVariance : ssVariance;
    const variance = sorted.length > 1 ? varianceFn(sorted) : 0;
    const sd = Math.sqrt(Math.max(variance, 0));
    const sem = sd / Math.sqrt(nBio || 1);
    const cv = ssMean(sorted) === 0 ? 0 : (sd / Math.abs(ssMean(sorted))) * 100;
    const q1 = quantileSorted(sorted, 0.25);
    const q3 = quantileSorted(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerFence = q1 - iqrMultiplier * iqr;
    const upperFence = q3 + iqrMultiplier * iqr;
    const iqrFlags = sorted.reduce<{ low: number; high: number; count: number; indices: number[] }>(
      (acc, v, idx) => {
        if (v < lowerFence) {
          acc.low += 1;
          acc.count += 1;
          acc.indices.push(idx);
        } else if (v > upperFence) {
          acc.high += 1;
          acc.count += 1;
          acc.indices.push(idx);
        }
        return acc;
      },
      { low: 0, high: 0, count: 0, indices: [] }
    );

    const shapiro = approxShapiro(sorted);
    const ci = ciMethod === "t95" && sorted.length > 1 ? computeTci(ssMean(sorted), sem, nBio) : null;

    results.push({
      group,
      nBio,
      nTech,
      mean: ssMean(sorted),
      median: ssMedian(sorted),
      modes,
      sd,
      variance,
      sem,
      cv,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      range: sorted[sorted.length - 1] - sorted[0],
      ci95: ci,
      normality: { w: shapiro?.W ?? null, label: shapiro?.label ?? "not reliable" },
      iqrFlags,
      valuesUsed: sorted,
      iqrMultiplier,
    });
  });

  return { stats: results, warnings };
}

function computeTci(mean: number, sem: number, nBio: number) {
  if (nBio <= 1) return null;
  const df = nBio - 1;
  const t = studentt.inv(0.975, df);
  const width = t * sem;
  return { low: mean - width, high: mean + width, df };
}

export function computeFoldChanges(stats: GroupStats[], reference: string): FoldChange[] {
  const ref = stats.find((g) => g.group === reference);
  if (!ref) return [];
  return stats
    .filter((g) => g.group !== reference)
    .map((g) => {
      const percentChange = ((g.mean - ref.mean) / ref.mean) * 100;
      const foldChange = g.mean / ref.mean;
      const log2FoldChange = foldChange > 0 ? Math.log2(foldChange) : null;
      return { group: g.group, reference, percentChange, foldChange, log2FoldChange };
    });
}
