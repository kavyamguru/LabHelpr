import { AnalysisRow, GroupSummary, ReplicateMode } from "./types";

export interface ChartSeries {
  label: string;
  data: number[];
  meta?: Record<string, unknown>;
}

export interface HistogramData {
  bins: number[];
  labels: string[];
  series: ChartSeries[];
}

export interface BoxLikeData {
  labels: string[];
  quartiles: { min: number; q1: number; median: number; q3: number; max: number; outliers: number[] }[];
}

export interface ViolinData {
  labels: string[];
  violins: { values: number[] }[];
}

export interface StripData {
  labels: string[];
  points: { x: string; y: number; bioRep?: string | null; techRep?: string | null; outlier?: boolean }[];
}

export interface QQData {
  label: string;
  points: { x: number; y: number }[];
}

export interface BioTechData {
  groups: string[];
  bioMeans: { group: string; bioRep: string; value: number }[];
  techPoints: { group: string; bioRep: string; techRep?: string | null; value: number }[];
  warnings: string[];
}

function nonNullResponses(rows: AnalysisRow[]): { group: string; value: number; bioRep?: string | null; techRep?: string | null }[] {
  return rows
    .filter((r) => r.response !== null)
    .map((r) => ({ group: r.group ?? "(unlabeled)", value: r.response as number, bioRep: r.bioRep, techRep: r.techRep }));
}

export function buildHistogramData(rows: AnalysisRow[], binCount = 10): HistogramData {
  const points = nonNullResponses(rows);
  if (!points.length) return { bins: [], labels: [], series: [] };
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) || 1;
  const step = width / binCount;
  const bins = new Array(binCount).fill(0).map((_, i) => min + i * step);

  const groups = Array.from(new Set(points.map((p) => p.group)));
  const series: ChartSeries[] = groups.map((g) => ({ label: g, data: new Array(binCount).fill(0) }));

  points.forEach((p) => {
    const idx = Math.min(binCount - 1, Math.floor((p.value - min) / step));
    const s = series.find((s) => s.label === p.group);
    if (s) s.data[idx] += 1;
  });

  const labels = bins.map((b, i) => {
    const end = i === bins.length - 1 ? max : bins[i + 1];
    return `${b.toFixed(3)}–${end.toFixed(3)}`;
  });

  return { bins, labels, series };
}

export function buildHistogramFacets(rows: AnalysisRow[], binCount = 10): Record<string, HistogramData> {
  const points = nonNullResponses(rows);
  const byGroup: Record<string, AnalysisRow[]> = {};
  points.forEach((p) => {
    const key = p.group;
    if (!byGroup[key]) byGroup[key] = [] as any;
    (byGroup[key] as any).push({ response: p.value });
  });
  const facets: Record<string, HistogramData> = {};
  Object.entries(byGroup).forEach(([group, arr]) => {
    const values = arr.map((r: any) => r.response as number);
    if (!values.length) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = (max - min) || 1;
    const step = width / binCount;
    const bins = new Array(binCount).fill(0).map((_, i) => min + i * step);
    const series = [{ label: group, data: new Array(binCount).fill(0) }];
    values.forEach((v: number) => {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / step));
      series[0].data[idx] += 1;
    });
    const labels = bins.map((b, i) => {
      const end = i === bins.length - 1 ? max : bins[i + 1];
      return `${b.toFixed(3)}–${end.toFixed(3)}`;
    });
    facets[group] = { bins, labels, series };
  });
  return facets;
}

export function buildBoxData(rows: AnalysisRow[]): BoxLikeData {
  const points = nonNullResponses(rows);
  if (!points.length) return { labels: [], quartiles: [] };
  const groups = Array.from(new Set(points.map((p) => p.group)));
  const quartiles = groups.map((g) => {
    const vals = points.filter((p) => p.group === g).map((p) => p.value).sort((a, b) => a - b);
    if (!vals.length) return { min: NaN, q1: NaN, median: NaN, q3: NaN, max: NaN, outliers: [] as number[] };
    const q = (p: number) => {
      const pos = (vals.length - 1) * p;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (vals[base + 1] !== undefined) return vals[base] + rest * (vals[base + 1] - vals[base]);
      return vals[base];
    };
    const q1 = q(0.25);
    const median = q(0.5);
    const q3 = q(0.75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const outliers = vals.filter((v) => v < lower || v > upper);
    return { min: vals[0], q1, median, q3, max: vals[vals.length - 1], outliers };
  });
  return { labels: groups, quartiles };
}

export function buildViolinData(rows: AnalysisRow[]): ViolinData & { counts: Record<string, number> } {
  const points = nonNullResponses(rows);
  if (!points.length) return { labels: [], violins: [], counts: {} };
  const groups = Array.from(new Set(points.map((p) => p.group)));
  const counts: Record<string, number> = {};
  const violins = groups.map((g) => {
    const vals = points.filter((p) => p.group === g).map((p) => p.value);
    counts[g] = vals.length;
    return { values: vals };
  });
  return { labels: groups, violins, counts };
}

export function buildStripData(rows: AnalysisRow[]): StripData {
  const points = nonNullResponses(rows).map((p) => ({ x: p.group, y: p.value, bioRep: p.bioRep, techRep: p.techRep }));
  const labels = Array.from(new Set(points.map((p) => p.x)));

  // flag outliers per group using IQR
  labels.forEach((g) => {
    const vals = points.filter((p) => p.x === g).map((p) => p.y).sort((a, b) => a - b);
    if (vals.length < 4) return;
    const q = (p: number) => {
      const pos = (vals.length - 1) * p;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (vals[base + 1] !== undefined) return vals[base] + rest * (vals[base + 1] - vals[base]);
      return vals[base];
    };
    const q1 = q(0.25);
    const q3 = q(0.75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    points.forEach((p) => {
      if (p.x !== g) return;
      if (p.y < lower || p.y > upper) (p as any).outlier = true;
    });
  });

  return { labels, points };
}

export function buildQQData(rows: AnalysisRow[], minN = 5): QQData | null {
  const pts = nonNullResponses(rows).map((p) => p.value).sort((a, b) => a - b);
  if (pts.length < minN) return null;
  const n = pts.length;
  const points = pts.map((v, i) => {
    // normal quantile approximation (Blom)
    const p = (i + 0.375) / (n + 0.25);
    const z = inverseNormal(p);
    return { x: z, y: v };
  });
  return { label: "QQ", points };
}

// Approx inverse normal CDF via approximation (Hastings)
function inverseNormal(p: number) {
  if (p <= 0 || p >= 1) return NaN;
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

  const c1 = -0.00778489400243029;
  const c2 = -0.322396458041136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;

  const d1 = 0.00778469570904146;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r, x;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    x = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
  return x;
}

export function buildBioTechData(rows: AnalysisRow[], mode: ReplicateMode, collapseTechnical: boolean): BioTechData {
  const points = nonNullResponses(rows);
  const groups = Array.from(new Set(points.map((p) => p.group)));
  const bioMeansMap = new Map<string, number[]>();
  const techPoints: BioTechData["techPoints"] = [];
  const warnings: string[] = [];

  points.forEach((p) => {
    const key = `${p.group}||${p.bioRep || ""}`;
    if (!bioMeansMap.has(key)) bioMeansMap.set(key, []);
    if (p.bioRep) bioMeansMap.get(key)?.push(p.value);
    techPoints.push({ group: p.group, bioRep: p.bioRep ?? "", techRep: p.techRep, value: p.value });
  });

  const bioMeans: BioTechData["bioMeans"] = [];
  bioMeansMap.forEach((vals, key) => {
    const [group, bioRep] = key.split("||");
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    bioMeans.push({ group, bioRep, value: mean });
  });

  if (mode === "nested" && !collapseTechnical) {
    warnings.push("Technical replicates are shown; they are not biological n.");
  }
  if (!bioMeans.length) {
    warnings.push("No biological replicate IDs; treating rows as individual units.");
  }

  return { groups, bioMeans, techPoints, warnings };
}
