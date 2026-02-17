"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */

import { useMemo, useRef, useState, useEffect, type RefObject } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { quantile, mean, median, variance } from "simple-statistics";
import { jStat } from "jstat";
import { Scatter, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { levenbergMarquardt } from "ml-levenberg-marquardt";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = "Arial, Helvetica, sans-serif";
ChartJS.defaults.font.size = 10;
ChartJS.defaults.font.weight = "normal";

type Mapping = {
  treatment?: string;
  concentration?: string;
  bioReplicate?: string;
  techReplicate?: string;
  response?: string;
  targetCt?: string;
  housekeepingCt?: string;
  time?: string;
  status?: string;
  factorA?: string;
  factorB?: string;
  units?: string;
  xVar?: string;
  yVar?: string;
  catA?: string;
  catB?: string;
};

type DecisionOutcome = {
  test: string;
  rationale: string;
  resultSummary?: string;
};

type PAdjustMethod = "none" | "bonferroni" | "holm" | "bh";

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/\s+/g, "_");
}

function inferColumns(headers: string[]): Mapping {
  const lower = headers.map((h) => normalizeHeader(h));
  const findMatch = (keywords: string[]) =>
    headers.find((h, idx) => keywords.some((k) => lower[idx].includes(k)));

  return {
    treatment: findMatch(["treatment", "condition", "drug", "agent", "group"]),
    concentration: findMatch(["conc", "dose", "concentration", "molar", "ug_ml", "mg_ml"]),
    bioReplicate: findMatch(["biological", "bio_rep", "donor", "animal", "subject", "patient"]),
    techReplicate: findMatch(["technical", "tech_rep", "well", "replicate", "measurement", "well_id"]),
    response: findMatch(["value", "response", "signal", "readout", "measurement"]),
    targetCt: findMatch(["ct_target", "ct_targetgene", "ct_goi", "target_ct", "ct" ]),
    housekeepingCt: findMatch(["housekeeping", "reference", "ct_ref", "ct_housekeeping", "gapdh", "actb"]),
    time: findMatch(["time", "days", "weeks", "survival_time", "followup"]),
    status: findMatch(["status", "event", "censor", "censored", "death"]),
    factorA: findMatch(["factor_a", "factor1", "genotype", "strain", "line"]),
    factorB: findMatch(["factor_b", "factor2", "dose", "timepoint", "condition2"]),
    units: findMatch(["units", "unit", "measure_unit"]),
    xVar: findMatch(["x", "predictor", "independent", "time", "concentration", "dose"]),
    yVar: findMatch(["y", "response", "dependent", "signal", "outcome"]),
    catA: findMatch(["cat_a", "category", "group_a", "phenotype", "alive_dead"]),
    catB: findMatch(["cat_b", "category2", "group_b", "condition", "phenotype2"]),
  };
}

const samplePlateCsv = `Row,1,2,3,4,5,6,7,8,9,10,11,12
A,0.12,0.08,0.10,0.09,0.11,0.13,0.14,0.12,0.15,0.16,0.18,0.17
B,0.20,0.19,0.18,0.22,0.21,0.20,0.23,0.24,0.26,0.25,0.27,0.29
C,0.30,0.32,0.31,0.33,0.34,0.35,0.36,0.37,0.38,0.39,0.40,0.42
D,0.44,0.43,0.45,0.46,0.47,0.48,0.49,0.50,0.52,0.51,0.53,0.55
E,0.56,0.57,0.58,0.60,0.61,0.62,0.63,0.64,0.66,0.67,0.68,0.70
F,0.72,0.71,0.73,0.74,0.75,0.76,0.77,0.78,0.79,0.80,0.82,0.81
G,0.83,0.84,0.85,0.86,0.87,0.88,0.90,0.91,0.92,0.93,0.94,0.95
H,0.96,0.97,0.98,0.99,1.00,1.01,1.02,1.03,1.04,1.05,1.06,1.07`;

const sampleTwoGroupNormal = `Treatment,BioReplicate,TechReplicate,Value
Control,1,1,1.02
Control,1,2,0.98
Control,2,1,1.05
Control,2,2,1.01
Control,3,1,0.95
Control,3,2,1.00
Drug,1,1,1.30
Drug,1,2,1.22
Drug,2,1,1.28
Drug,2,2,1.35
Drug,3,1,1.18
Drug,3,2,1.26`;

const sampleMultiGroupNormal = `Treatment,BioReplicate,TechReplicate,Value
A,1,1,0.90
A,1,2,0.88
A,2,1,0.92
A,2,2,0.91
B,1,1,1.05
B,1,2,1.02
B,2,1,1.07
B,2,2,1.04
C,1,1,1.20
C,1,2,1.18
C,2,1,1.22
C,2,2,1.19`;

const sampleNonNormal = `Treatment,BioReplicate,TechReplicate,Value
Control,1,1,0.4
Control,1,2,0.5
Control,2,1,0.45
Control,2,2,0.55
Drug,1,1,1.2
Drug,1,2,1.4
Drug,2,1,1.3
Drug,2,2,1.5`;

const sampleDoseResponse = `Concentration,Value
0.01,0.02
0.03,0.05
0.1,0.12
0.3,0.25
1,0.45
3,0.62
10,0.78
30,0.88
100,0.93`;

const sampleStdCurve = `Concentration,Cq
100000,15.2
10000,18.5
1000,21.7
100,24.9
10,28.1`;

function looksLikePlateWide(headers: string[], rows: any[]): boolean {
  const normalized = headers.map((h) => normalizeHeader(h));
  const hasRowHeader = normalized.includes("row") || normalized.includes("rows");
  const numericColumns = headers.filter((h) => /^\d+$/.test(h.trim()));
  return hasRowHeader && numericColumns.length >= 3 && rows.length > 0;
}

function looksLikeWellColumns(headers: string[]): boolean {
  const wellPattern = /^[A-Ha-h](?:[1-9]|1[0-2])$/;
  const wellColumns = headers.filter((h) => wellPattern.test(h.trim()));
  return wellColumns.length >= 6; // heuristic threshold
}

function tidyPlateWide(headers: string[], rows: any[]) {
  const normalized = headers.map((h) => normalizeHeader(h));
  const rowKeyIndex = normalized.indexOf("row");
  if (rowKeyIndex === -1) return null;

  const numericColumns = headers
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) => /^\d+$/.test(h.trim()));

  const tidy: Array<Record<string, any>> = [];

  rows.forEach((r) => {
    const rowLabel = String(Object.values(r)[rowKeyIndex]).trim();
    numericColumns.forEach(({ h }) => {
      const value = (r as any)[h];
      const well = `${rowLabel}${h}`;
      tidy.push({ Well: well, Value: value, Row: rowLabel, Column: h });
    });
  });

  return tidy;
}

function tidyWellColumns(headers: string[], rows: any[]) {
  const wellPattern = /^[A-Ha-h](?:[1-9]|1[0-2])$/;
  const wellColumns = headers
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) => wellPattern.test(h.trim()));

  const tidy: Array<Record<string, any>> = [];
  rows.forEach((r) => {
    wellColumns.forEach(({ h }) => {
      tidy.push({ Well: h, Value: (r as any)[h] });
    });
  });

  return tidy.length ? tidy : null;
}

function fallbackTidy(rows: any[]) {
  return rows;
}

function formatPreview(rows: any[], limit = 8) {
  if (!rows || rows.length === 0) return [];
  return rows.slice(0, limit);
}

function safeNumeric(val: any) {
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function formatP(p: number) {
  if (p < 0.001) return "P < 0.001";
  return `P = ${p.toPrecision(3)}`;
}

function tidyExport(rows: Array<Record<string, any>>, filename: string) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function aggregateBiologicalMeans(rows: any[], mapping: Mapping, responseColumn?: string) {
  const groupKey = mapping.treatment || mapping.concentration || mapping.bioReplicate;
  if (!rows || !responseColumn) return { groups: {}, totalBioN: 0, tidy: [] as Array<Record<string, any>>, techByGroupBio: {}, bioMeansByGroup: {} } as { groups: Record<string, number[]>; totalBioN: number; tidy: Array<Record<string, any>>; techByGroupBio: Record<string, Record<string, number[]>>; bioMeansByGroup: Record<string, number[]> };
  const techByGroupBio: Record<string, Record<string, number[]>> = {};
  rows.forEach((r, idx) => {
    const gValRaw = groupKey ? (r as any)[groupKey] : "Group";
    const gVal = gValRaw === undefined || gValRaw === null || gValRaw === "" ? "(missing)" : String(gValRaw);
    const bio = mapping.bioReplicate ? String((r as any)[mapping.bioReplicate] ?? `(bio ${idx + 1})`) : `(bio ${idx + 1})`;
    const resp = safeNumeric((r as any)[responseColumn]);
    if (resp === null) return;
    if (!techByGroupBio[gVal]) techByGroupBio[gVal] = {};
    if (!techByGroupBio[gVal][bio]) techByGroupBio[gVal][bio] = [];
    techByGroupBio[gVal][bio].push(resp);
  });

  const tidy: Array<Record<string, any>> = [];
  const bioMeans: Record<string, number[]> = {};
  Object.keys(techByGroupBio).forEach((g) => {
    bioMeans[g] = Object.keys(techByGroupBio[g]).map((bio) => {
      const v = mean(techByGroupBio[g][bio]);
      tidy.push({ Group: g, Biological: bio, Value: v });
      return v;
    });
  });
  const totalBioN = Object.values(bioMeans).reduce((s, arr) => s + arr.length, 0);
  return { groups: bioMeans, totalBioN, tidy, techByGroupBio, bioMeansByGroup: bioMeans };
}

function shapiroWilkApprox(values: number[]) {
  const n = values.length;
  if (n < 3) return { w: 1, p: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const m = sorted.map((_, i) => jStat.normal.inv((i + 0.375) / (n + 0.25), 0, 1));
  const mMean = mean(m);
  const mCentered = m.map((v) => v - mMean);
  const aDenom = Math.sqrt(mCentered.reduce((s, v) => s + v * v, 0));
  const a = mCentered.map((v) => v / aDenom);
  const xMean = mean(sorted);
  const numerator = Math.pow(sorted.reduce((s, x, i) => s + a[i] * x, 0), 2);
  const denominator = sorted.reduce((s, x) => s + Math.pow(x - xMean, 2), 0);
  const w = denominator === 0 ? 1 : numerator / denominator;
  const y = Math.log(1 - w);
  const mu = -1.2725 + 1.0521 * Math.log(n);
  const sigma = 1.0308 - 0.26758 * Math.log(n);
  const z = (y - mu) / sigma;
  const p = 1 - jStat.normal.cdf(z, 0, 1);
  return { w, p: Math.max(0, Math.min(1, p)) };
}

function leveneTest(groups: Record<string, number[]>) {
  const groupKeys = Object.keys(groups).filter((k) => groups[k].length > 0);
  const k = groupKeys.length;
  const N = groupKeys.reduce((s, k2) => s + groups[k2].length, 0);
  if (k < 2 || N === 0) return null;
  const z: number[] = [];
  const labels: string[] = [];
  groupKeys.forEach((key) => {
    const m = median(groups[key]);
    groups[key].forEach((v) => {
      z.push(Math.abs(v - m));
      labels.push(key);
    });
  });

  const groupMeans: Record<string, number> = {};
  groupKeys.forEach((k2) => {
    const vals = labels.map((lbl, idx) => (lbl === k2 ? z[idx] : null)).filter((v) => v !== null) as number[];
    groupMeans[k2] = vals.length ? mean(vals) : 0;
  });
  const grandMean = mean(z);

  const numerator = groupKeys.reduce((s, k2) => s + groups[k2].length * Math.pow(groupMeans[k2] - grandMean, 2), 0) * (N - k);
  const denominator = z.reduce((s, val, idx) => s + Math.pow(val - groupMeans[labels[idx]], 2), 0) * (k - 1);
  if (denominator === 0) return { f: 0, p: 1 };
  const f = numerator / denominator;
  const p = 1 - jStat.centralF.cdf(f, k - 1, N - k);
  return { f, p: Math.max(0, Math.min(1, p)) };
}

function pairedTTest(a: number[], b: number[]) {
  if (a.length !== b.length || a.length < 3) return null;
  const diffs = a.map((v, i) => v - b[i]);
  const n = diffs.length;
  const m = mean(diffs);
  const s2 = variance(diffs);
  const t = m / Math.sqrt(s2 / n);
  const df = n - 1;
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  const sd = Math.sqrt(s2);
  const d = m / sd;
  const hedgesG = d * (1 - 3 / (4 * n - 9));
  const ci = bootstrapMeanDiffCI(a, b, true);
  return { t, df, p: Math.max(0, Math.min(1, p)), diffs, diff: m, d, hedgesG, ci };
}

function wilcoxonSignedRank(a: number[], b: number[]) {
  if (a.length !== b.length || a.length < 3) return null;
  const diffs = a.map((v, i) => v - b[i]).filter((d) => d !== 0);
  if (diffs.length < 3) return null;
  const ranks = diffs
    .map((d, idx) => ({ d, idx, abs: Math.abs(d) }))
    .sort((x, y) => x.abs - y.abs)
    .map((item, i) => ({ ...item, rank: i + 1 }));
  const Wplus = ranks.filter((r) => r.d > 0).reduce((s, r) => s + r.rank, 0);
  const Wminus = ranks.filter((r) => r.d < 0).reduce((s, r) => s + r.rank, 0);
  const n = ranks.length;
  const W = Math.min(Wplus, Wminus);
  const mu = (n * (n + 1)) / 4;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
  if (sigma === 0) return null;
  const z = (W - mu) / sigma;
  const p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
  return { W, p: Math.max(0, Math.min(1, p)), n, diffs };
}

function bootstrapMeanDiffCI(a: number[], b: number[], paired: boolean, reps = 2000, alpha = 0.05) {
  const diffs: number[] = [];
  for (let i = 0; i < reps; i++) {
    if (paired) {
      const sample = a.map((_, idx) => {
        const j = Math.floor(Math.random() * a.length);
        return a[j] - b[j];
      });
      diffs.push(mean(sample));
    } else {
      const sa = a.map(() => a[Math.floor(Math.random() * a.length)]);
      const sb = b.map(() => b[Math.floor(Math.random() * b.length)]);
      diffs.push(mean(sa) - mean(sb));
    }
  }
  diffs.sort((x, y) => x - y);
  const lo = diffs[Math.floor((alpha / 2) * diffs.length)] ?? diffs[0];
  const hi = diffs[Math.floor((1 - alpha / 2) * diffs.length)] ?? diffs[diffs.length - 1];
  return [lo, hi] as [number, number];
}

function studentTTest(a: number[], b: number[], equalVariance: boolean) {
  const na = a.length;
  const nb = b.length;
  const meanA = mean(a);
  const meanB = mean(b);
  const varA = variance(a);
  const varB = variance(b);
  const diff = meanA - meanB;

  let t = 0;
  let df = 0;
  let sp2 = 0;
  if (equalVariance) {
    sp2 = ((na - 1) * varA + (nb - 1) * varB) / (na + nb - 2);
    t = diff / Math.sqrt(sp2 * (1 / na + 1 / nb));
    df = na + nb - 2;
  } else {
    sp2 = (varA + varB) / 2; // for d approx
    t = diff / Math.sqrt(varA / na + varB / nb);
    df = Math.pow(varA / na + varB / nb, 2) /
      ((Math.pow(varA / na, 2) / (na - 1)) + (Math.pow(varB / nb, 2) / (nb - 1)));
  }
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  const d = diff / Math.sqrt(sp2);
  const hedgesG = d * (1 - 3 / (4 * (na + nb) - 9));
  const ci = bootstrapMeanDiffCI(a, b, false);
  return { t, df, p: Math.max(0, Math.min(1, p)), diff, d, hedgesG, ci };
}

function anovaOneWay(groups: Record<string, number[]>) {
  const keys = Object.keys(groups).filter((k) => groups[k].length > 0);
  const k = keys.length;
  const n = keys.reduce((s, k2) => s + groups[k2].length, 0);
  const grandMean = mean(keys.flatMap((k2) => groups[k2]));
  const ssBetween = keys.reduce((s, k2) => s + groups[k2].length * Math.pow(mean(groups[k2]) - grandMean, 2), 0);
  const ssWithin = keys.reduce((s, k2) => s + groups[k2].reduce((acc, v) => acc + Math.pow(v - mean(groups[k2]), 2), 0), 0);
  const dfBetween = k - 1;
  const dfWithin = n - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const f = msBetween / msWithin;
  const p = 1 - jStat.centralF.cdf(f, dfBetween, dfWithin);
  const eta2 = ssBetween / (ssBetween + ssWithin);
  const omega2 = ((ssBetween - dfBetween * msWithin) / (ssBetween + ssWithin + msWithin)) || 0;
  return { f, p: Math.max(0, Math.min(1, p)), dfBetween, dfWithin, msWithin, eta2, omega2 };
}

function tukeyHSD(groups: Record<string, number[]>, msWithin: number, dfWithin: number) {
  const keys = Object.keys(groups).filter((k) => groups[k].length > 0);
  const results: Array<{ pair: string; diff: number; se: number; t: number; p: number }> = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      const diff = mean(groups[a]) - mean(groups[b]);
      const se = Math.sqrt(msWithin * (1 / groups[a].length + 1 / groups[b].length));
      const t = diff / se;
      const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), dfWithin));
      results.push({ pair: `${a} vs ${b}`, diff, se, t, p });
    }
  }
  return results;
}

function logRankTest(groups: Record<string, { time: number; status: number }[]>) {
  const keys = Object.keys(groups).filter((k) => groups[k].length > 0);
  if (keys.length < 2) return null;
  const events: Array<{ time: number; group: string; status: number }> = [];
  keys.forEach((g) => groups[g].forEach((r) => events.push({ ...r, group: g })));
  events.sort((a, b) => a.time - b.time);
  const atRisk: Record<string, number> = {};
  keys.forEach((k) => { atRisk[k] = groups[k].length; });
  let chi = 0;
  let df = keys.length - 1;
  events.forEach((e, idx) => {
    const t = e.time;
    const atT = events.filter((x) => x.time === t);
    const d = atT.filter((x) => x.status === 1).length;
    const n = Object.values(atRisk).reduce((s, v) => s + v, 0);
    if (n === 0) return;
    const obs: number[] = keys.map((k) => atT.filter((x) => x.status === 1 && x.group === k).length);
    const exp: number[] = keys.map((k) => (atRisk[k] / n) * d);
    const varRow = keys.map((k) => (atRisk[k] / n) * (1 - atRisk[k] / n) * (d * (n - d) / (n - 1 || 1)));
    const sumVar = varRow.reduce((s, v) => s + v, 0) || 1;
    const OminusE = obs.map((o, i) => o - exp[i]);
    const contrib = OminusE.reduce((s, oe) => s + oe, 0); // aggregated for simplicity
    chi += Math.pow(contrib, 2) / sumVar;
    atT.forEach((x) => { atRisk[x.group] -= 1; });
    events.splice(idx + 1, atT.length - 1);
  });
  const p = 1 - jStat.chisquare.cdf(chi, df);
  return { chi, df, p };
}

function adjustPValues(values: number[], method: PAdjustMethod) {
  const m = values.length;
  if (!m || method === "none") return values.slice();
  if (method === "bonferroni") return values.map((p) => Math.min(1, p * m));
  if (method === "holm") {
    const sorted = values.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
    const adjusted: number[] = new Array(m).fill(1);
    sorted.forEach((item, idx) => {
      adjusted[item.i] = Math.min(1, (m - idx) * item.p);
    });
    // ensure monotonic non-decreasing when ordered by original positions is not required; Holm needs cumulative max in sorted order
    let cum = 0;
    for (let i = m - 1; i >= 0; i--) {
      cum = Math.max(cum, adjusted[sorted[i].i]);
      adjusted[sorted[i].i] = cum;
    }
    return adjusted;
  }
  if (method === "bh") {
    const sorted = values.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
    const adjusted: number[] = new Array(m).fill(1);
    let minAdj = 1;
    for (let i = m - 1; i >= 0; i--) {
      const adj = (m / (i + 1)) * sorted[i].p;
      minAdj = Math.min(minAdj, adj);
      adjusted[sorted[i].i] = Math.min(1, minAdj);
    }
    return adjusted;
  }
  return values.slice();
}

function twoWayANOVA(rows: Array<Record<string, any>>, response: string, factorA: string, factorB: string) {
  if (!rows.length) return null;
  const data = rows
    .map((r) => ({ a: String((r as any)[factorA]), b: String((r as any)[factorB]), y: safeNumeric((r as any)[response]) }))
    .filter((r) => r.y !== null) as { a: string; b: string; y: number }[];
  if (!data.length) return null;
  const levelsA = Array.from(new Set(data.map((d) => d.a)));
  const levelsB = Array.from(new Set(data.map((d) => d.b)));
  const grandMean = mean(data.map((d) => d.y));
  const n = data.length;
  const SSA = levelsA.reduce((s, a) => {
    const vals = data.filter((d) => d.a === a).map((d) => d.y);
    return s + vals.length * Math.pow(mean(vals) - grandMean, 2);
  }, 0);
  const SSB = levelsB.reduce((s, b) => {
    const vals = data.filter((d) => d.b === b).map((d) => d.y);
    return s + vals.length * Math.pow(mean(vals) - grandMean, 2);
  }, 0);
  const cellMeans: Record<string, number> = {};
  levelsA.forEach((a) => {
    levelsB.forEach((b) => {
      const vals = data.filter((d) => d.a === a && d.b === b).map((d) => d.y);
      if (vals.length) cellMeans[`${a}||${b}`] = mean(vals);
    });
  });
  const SSAB = levelsA.reduce((s, a) => s + levelsB.reduce((s2, b) => {
    const key = `${a}||${b}`;
    const vals = data.filter((d) => d.a === a && d.b === b).map((d) => d.y);
    if (!vals.length) return s2;
    const cellMean = cellMeans[key];
    const aMean = mean(data.filter((d) => d.a === a).map((d) => d.y));
    const bMean = mean(data.filter((d) => d.b === b).map((d) => d.y));
    return s2 + vals.length * Math.pow(cellMean - aMean - bMean + grandMean, 2);
  }, 0), 0);
  const SST = data.reduce((s, d) => s + Math.pow(d.y - grandMean, 2), 0);
  const SSE = SST - SSA - SSB - SSAB;
  const dfA = levelsA.length - 1;
  const dfB = levelsB.length - 1;
  const dfAB = dfA * dfB;
  const dfE = n - levelsA.length * levelsB.length;
  if (dfE <= 0) return null;
  const MSA = SSA / dfA;
  const MSB = SSB / dfB;
  const MSAB = SSAB / dfAB;
  const MSE = SSE / dfE;
  const FA = MSA / MSE;
  const FB = MSB / MSE;
  const FAB = MSAB / MSE;
  const pA = 1 - jStat.centralF.cdf(FA, dfA, dfE);
  const pB = 1 - jStat.centralF.cdf(FB, dfB, dfE);
  const pAB = 1 - jStat.centralF.cdf(FAB, dfAB, dfE);
  // simple effects if interaction significant
  let simpleEffects: Array<{ within: string; factor: "A" | "B"; F: number; df1: number; df2: number; p: number }> = [];
  if (pAB < 0.05) {
    // A within each level of B
    levelsB.forEach((b) => {
      const subset = data.filter((d) => d.b === b);
      const aLevels = Array.from(new Set(subset.map((d) => d.a)));
      if (aLevels.length > 1) {
        const groups: Record<string, number[]> = {};
        aLevels.forEach((a) => { groups[a] = subset.filter((d) => d.a === a).map((d) => d.y); });
        const an = anovaOneWay(groups);
        if (an) simpleEffects.push({ within: `${factorB}=${b}`, factor: "A", F: an.f, df1: an.dfBetween, df2: an.dfWithin, p: an.p });
      }
    });
    // B within each level of A
    levelsA.forEach((a) => {
      const subset = data.filter((d) => d.a === a);
      const bLevels = Array.from(new Set(subset.map((d) => d.b)));
      if (bLevels.length > 1) {
        const groups: Record<string, number[]> = {};
        bLevels.forEach((b) => { groups[b] = subset.filter((d) => d.b === b).map((d) => d.y); });
        const an = anovaOneWay(groups);
        if (an) simpleEffects.push({ within: `${factorA}=${a}`, factor: "B", F: an.f, df1: an.dfBetween, df2: an.dfWithin, p: an.p });
      }
    });
  }
  return { FA, FB, FAB, dfA, dfB, dfAB, dfE, pA, pB, pAB, simpleEffects };
}

function bootstrapDiffCI(a: number[], b: number[], paired: boolean, reps = 2000, alpha = 0.05) {
  const diffs: number[] = [];
  for (let i = 0; i < reps; i++) {
    if (paired) {
      const sample = a.map((_, idx) => {
        const j = Math.floor(Math.random() * a.length);
        return a[j] - b[j];
      });
      diffs.push(mean(sample));
    } else {
      const sa = a.map(() => a[Math.floor(Math.random() * a.length)]);
      const sb = b.map(() => b[Math.floor(Math.random() * b.length)]);
      diffs.push(mean(sa) - mean(sb));
    }
  }
  diffs.sort((x, y) => x - y);
  const lo = diffs[Math.floor((alpha / 2) * diffs.length)] ?? diffs[0];
  const hi = diffs[Math.floor((1 - alpha / 2) * diffs.length)] ?? diffs[diffs.length - 1];
  return [lo, hi] as [number, number];
}

function mannWhitneyU(a: number[], b: number[]) {
  const combined = [...a.map((v) => ({ v, label: "a" })), ...b.map((v) => ({ v, label: "b" }))].sort((x, y) => x.v - y.v);
  const ranks: number[] = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].v === combined[i].v) j++;
    const rank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) ranks[k] = rank;
    i = j;
  }
  const Ra = ranks.reduce((s, r, idx) => s + (combined[idx].label === "a" ? r : 0), 0);
  const na = a.length;
  const nb = b.length;
  const U1 = Ra - (na * (na + 1)) / 2;
  const U2 = na * nb - U1;
  const U = Math.min(U1, U2);
  const mu = (na * nb) / 2;
  const sigma = Math.sqrt((na * nb * (na + nb + 1)) / 12);
  const z = (U - mu) / sigma;
  const p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
  const rankBiserial = 1 - (2 * U) / (na * nb);
  const ci = bootstrapDiffCI(a, b, false);
  return { U, p: Math.max(0, Math.min(1, p)), rankBiserial, ci };
}

function kruskalWallis(groups: Record<string, number[]>) {
  const keys = Object.keys(groups).filter((k) => groups[k].length > 0);
  const combined = keys.flatMap((k) => groups[k].map((v) => ({ v, label: k })) ).sort((a, b) => a.v - b.v);
  const ranks: number[] = new Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].v === combined[i].v) j++;
    const rank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) ranks[k] = rank;
    i = j;
  }
  const rankSums: Record<string, number> = {};
  keys.forEach((k) => { rankSums[k] = 0; });
  ranks.forEach((r, idx) => {
    const lbl = combined[idx].label;
    rankSums[lbl] += r;
  });

  const n = combined.length;
  const H = (12 / (n * (n + 1))) * keys.reduce((s, k) => s + (Math.pow(rankSums[k], 2) / groups[k].length), 0) - 3 * (n + 1);
  const df = keys.length - 1;
  const p = 1 - jStat.chisquare.cdf(H, df);
  return { H, p: Math.max(0, Math.min(1, p)), rankSums, ranks, keys, combined, n };
}

function dunnPosthoc(groups: Record<string, number[]>, kw: ReturnType<typeof kruskalWallis>, adjust: PAdjustMethod = "holm") {
  if (!kw || !kw.keys || !kw.combined) return [] as Array<{ pair: string; z: number; p: number; pAdj?: number }>;
  const keys = kw.keys;
  const n = kw.n;
  const N = n;
  const results: Array<{ pair: string; z: number; p: number; pAdj?: number }> = [];
  const rankSums = kw.rankSums as Record<string, number>;
  keys.forEach((a, i) => {
    for (let j = i + 1; j < keys.length; j++) {
      const b = keys[j];
      const Ra = rankSums[a];
      const Rb = rankSums[b];
      const na = groups[a].length;
      const nb = groups[b].length;
      const z = (Ra / na - Rb / nb) / Math.sqrt((N * (N + 1)) / 12 * (1 / na + 1 / nb));
      const p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
      results.push({ pair: `${a} vs ${b}`, z, p: Math.max(0, Math.min(1, p)) });
    }
  });
  if (!results.length) return results;
  const pAdj = adjustPValues(results.map((r) => r.p), adjust);
  return results.map((r, idx) => ({ ...r, pAdj: pAdj[idx] }));
}

function makeQQ(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const theoretical = sorted.map((_, i) => jStat.normal.inv((i + 0.5) / n, 0, 1));
  return { sample: sorted, theoretical };
}

function applyTransform(values: number[], mode: "none" | "log10" | "sqrt" | "arcsin") {
  if (mode === "none") return { vals: values, dropped: 0 };
  if (mode === "log10") {
    const kept = values.filter((v) => v > 0);
    return { vals: kept.map((v) => Math.log10(v)), dropped: values.length - kept.length };
  }
  if (mode === "sqrt") {
    const kept = values.filter((v) => v >= 0);
    return { vals: kept.map((v) => Math.sqrt(v)), dropped: values.length - kept.length };
  }
  if (mode === "arcsin") {
    const adjusted = values.map((v) => (v > 1 ? v / 100 : v));
    const kept = adjusted.filter((v) => v >= 0 && v <= 1);
    return { vals: kept.map((v) => Math.asin(Math.sqrt(v))), dropped: values.length - kept.length };
  }
  return { vals: values, dropped: 0 };
}

function pearson(x: number[], y: number[]) {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = mean(x);
  const my = mean(y);
  const num = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  const den = Math.sqrt(x.reduce((s, v) => s + Math.pow(v - mx, 2), 0) * y.reduce((s, v, i) => s + Math.pow(v - my, 2), 0));
  if (den === 0) return null;
  const r = num / den;
  const df = x.length - 2;
  const t = r * Math.sqrt(df / (1 - r * r));
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  return { r, t, df, p };
}

function spearman(x: number[], y: number[]) {
  if (x.length !== y.length || x.length < 3) return null;
  const rank = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return arr.map((v) => (sorted.indexOf(v) + sorted.lastIndexOf(v)) / 2 + 1);
  };
  const rx = rank(x);
  const ry = rank(y);
  const n = x.length;
  const d2 = rx.reduce((s, r, i) => s + Math.pow(r - ry[i], 2), 0);
  const r = 1 - ((6 * d2) / (n * (n * n - 1)));
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), n - 2));
  return { r, t, df: n - 2, p };
}

function linearRegression(x: number[], y: number[]) {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = mean(x);
  const my = mean(y);
  const Sxx = x.reduce((s, v) => s + Math.pow(v - mx, 2), 0);
  const Sxy = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0);
  const slope = Sxy / Sxx;
  const intercept = my - slope * mx;
  const yhat = x.map((v) => slope * v + intercept);
  const SSE = y.reduce((s, v, i) => s + Math.pow(v - yhat[i], 2), 0);
  const SST = y.reduce((s, v) => s + Math.pow(v - my, 2), 0);
  const R2 = 1 - SSE / SST;
  const df = x.length - 2;
  const mse = SSE / df;
  const seSlope = Math.sqrt(mse / Sxx);
  const seIntercept = Math.sqrt(mse * (1 / x.length + (mx * mx) / Sxx));
  const tcrit = jStat.studentt.inv(0.975, df);
  const slopeCI: [number, number] = [slope - tcrit * seSlope, slope + tcrit * seSlope];
  const interceptCI: [number, number] = [intercept - tcrit * seIntercept, intercept + tcrit * seIntercept];
  return { slope, intercept, R2, df, slopeCI, interceptCI, seSlope, seIntercept };
}

function slopeHeterogeneity(x: number[], y: number[], groups: string[]) {
  const uniq = Array.from(new Set(groups));
  if (uniq.length < 2) return null;
  const regs: Record<string, ReturnType<typeof linearRegression> | null> = {};
  uniq.forEach((g) => {
    const data = x.map((v, i) => ({ x: v, y: y[i], g: groups[i] })).filter((d) => d.x !== null && d.y !== null && d.g === g);
    regs[g] = data.length >= 3 ? linearRegression(data.map((d) => d.x), data.map((d) => d.y)) : null;
  });
  const comparisons: Array<{ a: string; b: string; diff: number; seDiff: number; t: number; df: number; p: number }> = [];
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      const ga = uniq[i];
      const gb = uniq[j];
      const regA = regs[ga];
      const regB = regs[gb];
      if (!regA || !regB || regA.seSlope === undefined || regB.seSlope === undefined) continue;
      const diff = regA.slope - regB.slope;
      const seDiff = Math.sqrt(Math.pow(regA.seSlope, 2) + Math.pow(regB.seSlope, 2));
      if (seDiff === 0) continue;
      const df = Math.min(regA.df, regB.df);
      const t = diff / seDiff;
      const p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
      comparisons.push({ a: ga, b: gb, diff, seDiff, t, df, p });
    }
  }
  if (!comparisons.length) return null;
  const slopes: Record<string, number> = {};
  Object.keys(regs).forEach((g) => { if (regs[g]?.slope !== undefined) slopes[g] = regs[g]!.slope; });
  return { comparisons, slopes };
}

function fisherExact2x2(table: number[][]) {
  const [a, b] = table[0];
  const [c, d] = table[1];
  const n = a + b + c + d;
  const factorial = (m: number) => {
    let r = 1;
    for (let i = 2; i <= m; i++) r *= i;
    return r;
  };
  const hyper = (x: number, y: number, z: number, w: number) => (factorial(x + y) * factorial(z + w) * factorial(x + z) * factorial(y + w)) / (factorial(x) * factorial(y) * factorial(z) * factorial(w) * factorial(n));
  const obsP = hyper(a, b, c, d);
  let p = 0;
  for (let i = 0; i <= a + b; i++) {
    const j = a + b - i;
    const k = a + c - i;
    const l = d + b - j;
    if (i < 0 || j < 0 || k < 0 || l < 0) continue;
    p += hyper(i, j, k, l);
  }
  return { p: Math.min(1, p), table, obsP };
}

function chiSquare(table: number[][]) {
  const rows = table.length;
  const cols = table[0].length;
  const rowSums = table.map((r) => r.reduce((s, v) => s + v, 0));
  const colSums = table[0].map((_, c) => table.reduce((s, r) => s + r[c], 0));
  const total = rowSums.reduce((s, v) => s + v, 0);
  let chi = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const exp = (rowSums[i] * colSums[j]) / total;
      chi += Math.pow(table[i][j] - exp, 2) / (exp || 1);
    }
  }
  const df = (rows - 1) * (cols - 1);
  const p = 1 - jStat.chisquare.cdf(chi, df);
  return { chi, df, p };
}

function fit4PL(x: number[], y: number[], opts?: { fixTop?: number | null; fixBottom?: number | null; rout?: boolean }) {
  if (x.length < 4 || y.length < 4) return null;
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  const init = [opts?.fixTop ?? maxY, 1, quantile(x, 0.5), opts?.fixBottom ?? minY];
  const limits = {
    minValues: [opts?.fixTop ?? -Infinity, -10, Math.min(...x) * 0.1 || 1e-6, opts?.fixBottom ?? -Infinity],
    maxValues: [opts?.fixTop ?? Infinity, 10, Math.max(...x) * 10 || 1e6, opts?.fixBottom ?? Infinity],
  };
  const model = (params: number[]) => (val: number) => {
    const [top, hill, ec50, bottom] = params;
    return bottom + (top - bottom) / (1 + Math.pow(val / ec50, hill));
  };

  const runFit = (xs: number[], ys: number[], initParams: number[]) => levenbergMarquardt({ x: xs, y: ys }, model, {
    initialValues: initParams,
    maxIterations: 200,
    damping: 1.5,
    gradientDifference: 1e-2,
    minValues: limits.minValues,
    maxValues: limits.maxValues,
  });

  let xs = [...x];
  let ys = [...y];
  let dropped: number[] = [];
  // ROUT-like exclusion based on residuals and BH-FDR (Q=0.01)
  if (opts?.rout && xs.length > 5) {
    const prelim = runFit(xs, ys, init);
    const [top0, hill0, ec500, bottom0] = prelim.parameterValues;
    const preds = xs.map((val) => bottom0 + (top0 - bottom0) / (1 + Math.pow(val / ec500, hill0)));
    const residuals = ys.map((v, idx) => v - preds[idx]);
    const sd = Math.sqrt(variance(residuals));
    const pVals = residuals.map((r) => {
      const z = sd > 0 ? Math.abs(r) / sd : 0;
      return 2 * (1 - jStat.normal.cdf(z, 0, 1));
    });
    const ranked = pVals.map((p, idx) => ({ p, idx })).sort((a, b) => a.p - b.p);
    const m = pVals.length;
    const threshold = 0.01; // Q=1%
    const toDrop = new Set<number>();
    ranked.forEach((item, i) => {
      if (item.p <= ((i + 1) / m) * threshold) toDrop.add(item.idx);
    });
    if (toDrop.size > 0 && toDrop.size < xs.length - 3) {
      dropped = Array.from(toDrop.values());
      xs = xs.filter((_, idx) => !toDrop.has(idx));
      ys = ys.filter((_, idx) => !toDrop.has(idx));
    }
  }

  const result = runFit(xs, ys, init);
  const [top, hill, ec50, bottom] = result.parameterValues;
  // Bootstrap EC50 for rough CI
  const boot: number[] = [];
  const nBoot = Math.min(150, Math.max(40, xs.length * 8));
  for (let i = 0; i < nBoot; i++) {
    const resampleIdx = xs.map(() => Math.floor(Math.random() * xs.length));
    const xr = resampleIdx.map((idx) => xs[idx]);
    const yr = resampleIdx.map((idx) => ys[idx]);
    const r2 = runFit(xr, yr, [top, hill, ec50, bottom]);
    boot.push(r2.parameterValues[2]);
  }
  const lower = quantile(boot, 0.025);
  const upper = quantile(boot, 0.975);

  return {
    top,
    hill,
    ec50,
    bottom,
    ci: [lower, upper],
    usedPoints: xs.length,
    dropped,
  };
}

function groupBy<T extends Record<string, any>>(rows: T[], key?: string) {
  const map: Record<string, T[]> = {};
  if (!key) return map;
  rows.forEach((r) => {
    const val = (r as any)[key];
    const bucket = val === undefined || val === null || val === "" ? "(missing)" : String(val);
    if (!map[bucket]) map[bucket] = [];
    map[bucket].push(r);
  });
  return map;
}

async function exportLayoutPdf(refs: { [k: string]: RefObject<HTMLElement | null> }, onDone?: () => void, onStart?: () => void) {
  onStart?.();
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  let first = true;
  const keys = Object.keys(refs);
  for (const key of keys) {
    const node = refs[key]?.current;
    if (!node) continue;
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2 });
      const img = new Image();
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
      if (!first) pdf.addPage();
      first = false;
      const pageW = pdf.internal.pageSize.getWidth();
      const scale = Math.min(pageW / img.width, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      pdf.addImage(img, "PNG", 20, 20, w, h);
    } catch (err) {
      console.error("Layout export failed", err);
    }
  }
  pdf.save("layout.pdf");
  onDone?.();
}

function exportReportPdf(parts: string[], onDone?: () => void, onStart?: () => void) {
  onStart?.();
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const text = parts.filter(Boolean).join("\n\n");
  const lines = pdf.splitTextToSize(text, 560);
  pdf.text(lines, 20, 30);
  pdf.save("analysis_report.pdf");
  onDone?.();
}

function exportFigure(ref: RefObject<HTMLElement | null>, filename: string, format: "png" | "pdf", onDone?: () => void, onStart?: () => void) {
  const node = ref.current;
  if (!node) return;
  onStart?.();
  toPng(node, { pixelRatio: 6.25, cacheBust: true })
    .then((dataUrl) => {
      if (format === "png") {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${filename}.png`;
        link.click();
      } else {
        const img = new Image();
        img.onload = () => {
          const pdf = new jsPDF({ orientation: img.width > img.height ? "l" : "p", unit: "pt", format: [img.width, img.height] });
          pdf.addImage(img, "PNG", 0, 0, img.width, img.height);
          pdf.save(`${filename}.pdf`);
        };
        img.src = dataUrl;
      }
    })
    .catch((err) => {
      console.error("Export failed", err);
    })
    .finally(() => {
      onDone?.();
    });
}

export default function StatisticalAnalysisPage() {
  const [rawRows, setRawRows] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [tidyRows, setTidyRows] = useState<any[] | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [dataType, setDataType] = useState<"continuous" | "dose-response" | "survival" | "correlation" | "categorical">("continuous");
  const [independence, setIndependence] = useState<"independent" | "paired">("independent");
  const [effectSizeD, setEffectSizeD] = useState<number>(0.6);
  const [effectSizeEta2, setEffectSizeEta2] = useState<number>(0.08);
  const [fixTopEnabled, setFixTopEnabled] = useState(false);
  const [fixBottomEnabled, setFixBottomEnabled] = useState(false);
  const [fixTopValue, setFixTopValue] = useState<number>(100);
  const [fixBottomValue, setFixBottomValue] = useState<number>(0);
  const [routEnabled, setRoutEnabled] = useState(false);
  const [controlLabel, setControlLabel] = useState<string>("Control");
  const [methodsText, setMethodsText] = useState<string>("");
  const [transformMode, setTransformMode] = useState<"none" | "log10" | "sqrt" | "arcsin">("none");
  const [units, setUnits] = useState<string>("");
  const [effTarget, setEffTarget] = useState<number>(2.0);
  const [effRef, setEffRef] = useState<number>(2.0);
  const [standardCurveE, setStandardCurveE] = useState<number | null>(null);
  const [layoutRefs, setLayoutRefs] = useState({ superplot: true, qq: true, box: true, dose: true, km: true });
  const [layoutOrder, setLayoutOrder] = useState({ superplot: 1, qq: 2, box: 3, dose: 4, km: 5 });
  const [layoutRefNode, setLayoutRefNode] = useState<HTMLDivElement | null>(null);
  const [reportText, setReportText] = useState<string>("");
  const [corrOutput, setCorrOutput] = useState<string>("");
  const [catOutput, setCatOutput] = useState<string>("");
  const layoutCanvasRef = useRef<HTMLDivElement>(null);
  const [miqeText, setMiqeText] = useState<string>("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [pAdjustMethod, setPAdjustMethod] = useState<PAdjustMethod>("none");
  const [arriveText, setArriveText] = useState<string>("");
  const [dunnettControl, setDunnettControl] = useState<string>("");
  const [stdCurveInput, setStdCurveInput] = useState<string>("");
  const [stdCurveStatus, setStdCurveStatus] = useState<string>("");
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const superplotRef = useRef<HTMLDivElement>(null);
  const qqRef = useRef<HTMLDivElement>(null);
  const doseRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const kmRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);

  function handleMappingChange(key: keyof Mapping, value: string) {
    setMapping((m) => ({ ...m, [key]: value || undefined }));
  }

  async function parseFile(file: File) {
    setError("");
    setStatus("Parsing file...");
    setRawRows(null);
    setTidyRows(null);

    try {
      let rows: any[] = [];

      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        if (result.errors.length) {
          throw new Error(result.errors[0].message);
        }
        rows = result.data as any[];
      } else if (file.name.endsWith(".xls") || file.name.endsWith(".xlsx")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];
      } else if (file.type === "text/plain") {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        rows = result.data as any[];
      } else {
        throw new Error("Unsupported file type. Please upload CSV or Excel.");
      }

      const headerList = rows.length ? Object.keys(rows[0]) : [];
      setHeaders(headerList);
      const guesses = inferColumns(headerList);
      setMapping(guesses);

      let tidy: any[] | null = null;
      if (looksLikePlateWide(headerList, rows)) {
        tidy = tidyPlateWide(headerList, rows);
        setStatus("Detected plate-shaped wide data. Converted to tidy long-form.");
      } else if (looksLikeWellColumns(headerList)) {
        tidy = tidyWellColumns(headerList, rows);
        setStatus("Detected well-named columns (A1–H12). Converted to tidy long-form.");
      } else {
        tidy = fallbackTidy(rows);
        setStatus("Data loaded. No plate reshape applied (already tidy or non-plate format).");
      }

      setRawRows(rows);
      setTidyRows(tidy);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to parse file");
      setStatus("");
    }
  }


  function handleGroupDrop(targetIdx: number) {
    if (dragIdx === null) return;
    setGroupOrder((prev) => {
      const base = prev.length ? prev : Object.keys(groups);
      const arr = [...base];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(targetIdx, 0, moved);
      return arr;
    });
    setDragIdx(null);
  }

  function loadSamplePlate() {
    const result = Papa.parse(samplePlateCsv, { header: true, skipEmptyLines: true });
    const rows = result.data as any[];
    const headerList = rows.length ? Object.keys(rows[0]) : [];
    setHeaders(headerList);
    const guesses = inferColumns(headerList);
    setMapping({ ...guesses, response: "Value" });
    const tidy = tidyPlateWide(headerList, rows);
    setRawRows(rows);
    setTidyRows(tidy);
    setStatus("Loaded sample 96-well plate data and converted to tidy form.");
    setError("");
  }

  function loadScenario(csv: string, type: "continuous" | "dose-response" | "survival" | "correlation" | "categorical") {
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const rows = parsed.data as any[];
    const headerList = rows.length ? Object.keys(rows[0]) : [];
    setHeaders(headerList);
    const guesses = inferColumns(headerList);
    setMapping({ ...guesses, response: guesses.response || "Value" });
    setRawRows(rows);
    setTidyRows(rows);
    setDataType(type);
    setStatus("Loaded sample dataset.");
    setError("");
  }

  const numericColumns = useMemo(() => {
    if (!tidyRows || tidyRows.length === 0) return [];
    const cols = Object.keys(tidyRows[0]);
    return cols.filter((c) => tidyRows.some((row) => Number.isFinite(safeNumeric((row as any)[c]))));
  }, [tidyRows]);

  const availableColumns = useMemo(() => headers, [headers]);

  const responseColumn = mapping.response || (tidyRows && tidyRows[0] && "Value" in tidyRows[0] ? "Value" : numericColumns[0]);
  const unitLabel = units?.trim() || "units";
  const [unitNotation, setUnitNotation] = useState<"parentheses" | "slash">("parentheses");
  const formatUnitsLabel = (base: string) => {
    if (!unitLabel) return base;
    return unitNotation === "slash" ? `${base} / ${unitLabel}` : `${base} (${unitLabel})`;
  };
  const responseWithUnits = responseColumn ? formatUnitsLabel(responseColumn) : formatUnitsLabel("Response");

  const { groups, totalBioN, tidy: tidyBio, techByGroupBio, bioMeansByGroup } = useMemo(() => {
    if (!tidyRows || !responseColumn) return { groups: {} as Record<string, number[]>, totalBioN: 0, tidy: [], techByGroupBio: {}, bioMeansByGroup: {} };
    return aggregateBiologicalMeans(tidyRows, mapping, responseColumn);
  }, [tidyRows, mapping, responseColumn]);

  useEffect(() => {
    const keys = Object.keys(groups);
    setGroupOrder((prev) => {
      if (!prev.length) return keys;
      const existing = prev.filter((k) => keys.includes(k));
      const remaining = keys.filter((k) => !existing.includes(k));
      return [...existing, ...remaining];
    });
  }, [groups]);

  const survival = useMemo(() => {
    if (!tidyRows || !mapping.time || !mapping.status || !mapping.treatment) return null;
    const grouped: Record<string, { time: number; status: number }[]> = {};
    tidyRows.forEach((r) => {
      const t = safeNumeric((r as any)[mapping.time!]);
      const s = safeNumeric((r as any)[mapping.status!]);
      const g = String((r as any)[mapping.treatment!] ?? "");
      if (t === null || s === null || g === "") return;
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push({ time: t, status: s > 0 ? 1 : 0 });
    });
    if (Object.keys(grouped).length < 2) return null;
    const logrank = logRankTest(grouped);
    return { grouped, logrank };
  }, [tidyRows, mapping.time, mapping.status, mapping.treatment]);

  const transformedGroups = useMemo(() => {
    const tg: Record<string, number[]> = {};
    const dropped: Record<string, number> = {};
    Object.keys(groups).forEach((k) => {
      const res = applyTransform(groups[k], transformMode);
      tg[k] = res.vals;
      dropped[k] = res.dropped;
    });
    return tg;
  }, [groups, transformMode]);

  const transformDropped = useMemo(() => {
    const entries = Object.entries(groups).map(([k, vals]) => {
      const res = applyTransform(vals, transformMode);
      return { group: k, dropped: res.dropped };
    });
    const totalDropped = entries.reduce((s, e) => s + e.dropped, 0);
    return { entries, totalDropped };
  }, [groups, transformMode]);

  const sortedKeys = useMemo(() => {
    const keys = Object.keys(groups);
    if (!groupOrder.length) return keys;
    const existing = groupOrder.filter((k) => keys.includes(k));
    const remaining = keys.filter((k) => !existing.includes(k));
    return [...existing, ...remaining];
  }, [groups, groupOrder]);

  const qpcr = useMemo(() => {
    if (!tidyRows || !mapping.targetCt || !mapping.housekeepingCt || !mapping.treatment) return null;
    const rows = tidyRows
      .map((r) => {
        const t = safeNumeric((r as any)[mapping.targetCt!]);
        const hk = safeNumeric((r as any)[mapping.housekeepingCt!]);
        const group = String((r as any)[mapping.treatment!] ?? "");
        const bio = mapping.bioReplicate ? String((r as any)[mapping.bioReplicate] ?? "") : "";
        const tech = mapping.techReplicate ? String((r as any)[mapping.techReplicate] ?? "") : "";
        if (t === null || hk === null || group === "" || bio === "") return null;
        return { group, bio, tech, deltaCt: t - hk };
      })
      .filter((v): v is { group: string; bio: string; tech: string; deltaCt: number } => v !== null);
    if (!rows.length) return null;
    // collapse tech -> bio means
    const byGroupBio: Record<string, Record<string, number[]>> = {};
    rows.forEach((r) => {
      if (!byGroupBio[r.group]) byGroupBio[r.group] = {};
      if (!byGroupBio[r.group][r.bio]) byGroupBio[r.group][r.bio] = [];
      byGroupBio[r.group][r.bio].push(r.deltaCt);
    });
    const bioMeans: Array<{ group: string; bio: string; deltaCt: number }> = [];
    Object.keys(byGroupBio).forEach((g) => {
      Object.keys(byGroupBio[g]).forEach((b) => {
        bioMeans.push({ group: g, bio: b, deltaCt: mean(byGroupBio[g][b]) });
      });
    });
    const control = controlLabel || "Control";
    const ctrlVals = bioMeans.filter((r) => r.group === control).map((r) => r.deltaCt);
    if (!ctrlVals.length) return { table: bioMeans, controlMissing: true };
    const ctrlMean = mean(ctrlVals);
    const eff = standardCurveE && standardCurveE > 0 ? standardCurveE : (effTarget > 0 ? effTarget : 2);
    const ddctRows = bioMeans.map((r) => {
      const ddct = r.deltaCt - ctrlMean;
      const fold = Math.pow(eff, -ddct);
      return { ...r, ddct, fold };
    });
    const groupStats: Record<string, { ddct: number[]; fold: number[] }> = {};
    ddctRows.forEach((r) => {
      if (!groupStats[r.group]) groupStats[r.group] = { ddct: [], fold: [] };
      groupStats[r.group].ddct.push(r.ddct);
      groupStats[r.group].fold.push(r.fold);
    });
    const summary = Object.keys(groupStats).map((g) => {
      const dd = groupStats[g].ddct;
      const fd = groupStats[g].fold;
      const ddMean = mean(dd);
      const ddSd = dd.length > 1 ? Math.sqrt(variance(dd)) : 0;
      const foldMean = mean(fd);
      const foldSd = ddSd * Math.log(eff) * foldMean;
      return { group: g, ddctMean: ddMean, ddctSd: ddSd, foldMean, foldSd };
    });
    return { table: ddctRows, summary, controlMissing: false, control }; 
  }, [tidyRows, mapping.targetCt, mapping.housekeepingCt, mapping.treatment, mapping.bioReplicate, mapping.techReplicate, controlLabel, effTarget, effRef, standardCurveE]);

  const corrAnalysis = useMemo(() => {
    if (dataType !== "correlation" || !mapping.xVar || !mapping.yVar || !tidyRows) return null;
    const xs: number[] = [];
    const ys: number[] = [];
    const groups: string[] = [];
    tidyRows.forEach((r) => {
      const xv = safeNumeric((r as any)[mapping.xVar!]);
      const yv = safeNumeric((r as any)[mapping.yVar!]);
      const g = mapping.treatment ? String((r as any)[mapping.treatment] ?? "") : "All";
      if (xv !== null && yv !== null) {
        xs.push(xv);
        ys.push(yv);
        groups.push(g);
      }
    });
    if (xs.length < 3) return null;
    const pear = pearson(xs, ys);
    const spear = spearman(xs, ys);
    const lin = linearRegression(xs, ys);
    const slopeHet = mapping.treatment ? slopeHeterogeneity(xs, ys, groups) : null;
    return { pear, spear, lin, slopeHet };
  }, [dataType, mapping.xVar, mapping.yVar, mapping.treatment, tidyRows]);

  const catAnalysis = useMemo(() => {
    if (dataType !== "categorical" || !mapping.catA || !mapping.catB || !tidyRows) return null;
    const tableMap: Record<string, Record<string, number>> = {};
    tidyRows.forEach((r) => {
      const a = String((r as any)[mapping.catA!] ?? "");
      const b = String((r as any)[mapping.catB!] ?? "");
      if (!tableMap[a]) tableMap[a] = {};
      tableMap[a][b] = (tableMap[a][b] || 0) + 1;
    });
    const rows = Object.keys(tableMap);
    const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(tableMap[r]))));
    if (rows.length === 0 || cols.length === 0) return null;
    const table: number[][] = rows.map((r) => cols.map((c) => tableMap[r][c] || 0));
    if (rows.length === 2 && cols.length === 2) {
      const fisher = fisherExact2x2(table);
      return { kind: "fisher", fisher, rows, cols, table } as const;
    }
    const chi = chiSquare(table);
    return { kind: "chi", chi, rows, cols, table } as const;
  }, [dataType, mapping.catA, mapping.catB, tidyRows]);

  const flatValues = useMemo(() => Object.values(transformedGroups).flat(), [transformedGroups]);

  const perGroupNormal = useMemo(() => {
    const entries = Object.entries(transformedGroups).filter(([, vals]) => vals.length >= 3);
    return entries.map(([k, vals]) => ({ group: k, ...shapiroWilkApprox(vals) }));
  }, [transformedGroups]);

  const diagnostics = useMemo(() => {
    if (flatValues.length === 0) return null;
    const normal = shapiroWilkApprox(flatValues);
    const qq = makeQQ(flatValues);
    const varianceCheck = leveneTest(transformedGroups);
    const transformedValues = flatValues;
    const transformedNormal = transformedValues.length ? shapiroWilkApprox(transformedValues) : null;
    return { normal, qq, varianceCheck, transformedNormal, perGroupNormal };
  }, [flatValues, transformedGroups, perGroupNormal]);

  const decision: DecisionOutcome | null = useMemo(() => {
    if (!diagnostics || !responseColumn) return null;
    const groupKeys = Object.keys(transformedGroups).filter((k) => transformedGroups[k].length > 0);
    const k = groupKeys.length;
    const normal = diagnostics.normal.p > 0.05;
    const transformedBetter = diagnostics.transformedNormal ? diagnostics.transformedNormal.p > 0.05 && diagnostics.normal.p <= 0.05 : false;
    const varianceEqual = diagnostics.varianceCheck ? diagnostics.varianceCheck.p > 0.05 : true;

    if (dataType === "dose-response" && mapping.concentration) {
      return {
        test: "4-Parameter Logistic (4PL) regression",
        rationale: "Dose-response data detected (continuous response vs concentration). Fitting 4PL to estimate EC50/IC50 with CI.",
      };
    }

    if (k === 2) {
      if (independence === "paired") {
        if (normal) {
          const paired = pairedTTest(transformedGroups[groupKeys[0]], transformedGroups[groupKeys[1]]);
          if (!paired) return { test: "Paired t-test", rationale: "Need equal-length pairs (n≥3) for paired t-test.", resultSummary: "Insufficient paired data." };
          const esText = `Δ=${paired.diff.toPrecision(4)} [95% CI ${paired.ci[0].toPrecision(4)}, ${paired.ci[1].toPrecision(4)}]; d=${paired.d.toPrecision(3)}, g=${paired.hedgesG.toPrecision(3)}`;
          return {
            test: "Paired t-test",
            rationale: "Continuous data, normal distribution, paired/matched samples. Paired t-test is appropriate.",
            resultSummary: `t(${paired.df}) = ${paired.t.toFixed(2)}, ${formatP(paired.p)}; ${esText}`,
          };
        }
        if (transformedBetter) {
          return {
            test: "Transform + re-test",
            rationale: "Data deviated from normality; transformation suggested before proceeding to paired testing.",
          };
        }
        const wsr = wilcoxonSignedRank(transformedGroups[groupKeys[0]], transformedGroups[groupKeys[1]]);
        if (!wsr) return { test: "Wilcoxon signed-rank", rationale: "Need equal-length pairs (n≥3, non-zero diffs) for Wilcoxon.", resultSummary: "Insufficient paired data." };
        const ci = bootstrapDiffCI(transformedGroups[groupKeys[0]], transformedGroups[groupKeys[1]], true);
        return {
          test: "Wilcoxon signed-rank",
          rationale: "Non-normal paired data; Wilcoxon signed-rank compares paired differences.",
          resultSummary: `W = ${wsr.W.toFixed(2)}, ${formatP(wsr.p)}; Δ≈${mean(wsr.diffs).toPrecision(4)} [95% CI ${ci[0].toPrecision(4)}, ${ci[1].toPrecision(4)}]` ,
        };
      }

      if (normal && independence === "independent") {
        const welch = studentTTest(transformedGroups[groupKeys[0]], transformedGroups[groupKeys[1]], false);
        const student = varianceEqual ? studentTTest(transformedGroups[groupKeys[0]], transformedGroups[groupKeys[1]], true) : null;
        const esText = `Δ=${welch.diff.toPrecision(4)} [95% CI ${welch.ci[0].toPrecision(4)}, ${welch.ci[1].toPrecision(4)}]; d=${welch.d.toPrecision(3)}, g=${welch.hedgesG.toPrecision(3)}`;
        const studentText = student ? `; Student Δ=${student.diff.toPrecision(4)} [${student.ci[0].toPrecision(4)}, ${student.ci[1].toPrecision(4)}]; d=${student.d.toPrecision(3)}, g=${student.hedgesG.toPrecision(3)}` : "";
        return {
          test: "Welch's t-test (default, two-tailed)",
          rationale: varianceEqual
            ? "Continuous data, normal distribution, independent samples. Welch reported by default; Student's t-test (assumes equal variance) also available."
            : "Continuous data, normal distribution, independent samples. Welch used because variances may differ (default, robust).",
          resultSummary: `Welch t(${welch.df.toFixed(1)}) = ${welch.t.toFixed(2)}, ${formatP(welch.p)}; ${esText}${studentText}`,
        };
      }

      // non-normal path
      if (transformedBetter) {
        return {
          test: "Transform + re-test",
          rationale: "Data deviated from normality; transformation suggested before proceeding to parametric testing.",
        };
      }
      const res = mannWhitneyU(transformedGroups[groupKeys[0]], transformedGroups[groupKeys[1]]);
      return {
        test: "Mann-Whitney U",
        rationale: "Data remain non-normal after transformation. Non-parametric comparison between two independent groups is recommended.",
        resultSummary: `U = ${res.U.toFixed(1)}, ${formatP(res.p)}; rank-biserial r = ${res.rankBiserial.toPrecision(3)}; Δ≈${(res.ci[0]+res.ci[1])/2 > 0 ? "+" : ""}${((res.ci[0]+res.ci[1])/2).toPrecision(4)} [${res.ci[0].toPrecision(4)}, ${res.ci[1].toPrecision(4)}]` ,
      };
    }

    if (k > 2) {
      if (normal) {
        const anova = anovaOneWay(transformedGroups);
        let posthoc = "";
        if (anova.p < 0.05) {
          const tukey = tukeyHSD(transformedGroups, anova.msWithin, anova.dfWithin)
            .filter((p) => p.p < 0.05)
            .map((p) => `${p.pair} (${formatP(p.p)})`)
            .join("; ");
          const pairwiseRaw = tukeyHSD(transformedGroups, anova.msWithin, anova.dfWithin);
          const pAdj = adjustPValues(pairwiseRaw.map((p) => p.p), "holm");
          const sigPairs = pairwiseRaw
            .map((p, idx) => ({ ...p, pAdj: pAdj[idx] }))
            .filter((p) => p.pAdj < 0.05)
            .map((p) => `${p.pair} (${formatP(p.pAdj)})`)
            .join("; ");
          posthoc = sigPairs ? `Pairwise comparisons (Holm-adjusted): ${sigPairs}` : "Pairwise comparisons (Holm-adjusted): none < 0.05.";
          if (dunnettControl && transformedGroups[dunnettControl]) {
            const dPairs = Object.keys(transformedGroups)
              .filter((g) => g !== dunnettControl && transformedGroups[g].length && transformedGroups[dunnettControl].length)
              .map((g) => {
                const res = studentTTest(transformedGroups[g], transformedGroups[dunnettControl], false);
                return `${g} vs ${dunnettControl}: ${formatP(res.p)}`;
              }).join("; ");
            if (dPairs) posthoc += ` Dunnett-style vs control: ${dPairs}`;
          }
        }
        return {
          test: "One-Way ANOVA",
          rationale: "Continuous data, normal distribution across groups; >2 groups so ANOVA is appropriate.",
          resultSummary: `F(${anova.dfBetween}, ${anova.dfWithin}) = ${anova.f.toFixed(2)}, ${formatP(anova.p)}; η²=${anova.eta2.toPrecision(3)}, ω²=${anova.omega2.toPrecision(3)}. ${posthoc}`,
        };
      }

      if (transformedBetter) {
        return {
          test: "Transform + ANOVA/parametric retest",
          rationale: "Non-normal data improved after transform; re-run ANOVA or Welch ANOVA on transformed values.",
        };
      }

      const kw = kruskalWallis(transformedGroups);
      const dunn = dunnPosthoc(transformedGroups, kw, "holm");
      const sigPairs = dunn.filter((d) => (d.pAdj ?? d.p) < 0.05).map((d) => `${d.pair} (${formatP(d.pAdj ?? d.p)})`).join("; ");
      return {
        test: "Kruskal-Wallis with Dunn post-hoc (Holm-adjusted)",
        rationale: "Data remain non-normal after transformation; Kruskal-Wallis is appropriate for >2 groups.",
        resultSummary: `H = ${kw.H.toFixed(2)}, ${formatP(kw.p)}${kw.p < 0.05 ? (sigPairs ? `; Dunn (Holm): ${sigPairs}` : "; Dunn (Holm): no pairs < 0.05") : ""}`,
      };
    }

    return null;
  }, [diagnostics, transformedGroups, dataType, independence, mapping.concentration, responseColumn, dunnettControl]);

  const powerEstimates = useMemo(() => {
    const alpha = 0.05;
    const power = 0.8;
    const zAlpha = jStat.normal.inv(1 - alpha / 2, 0, 1);
    const zBeta = jStat.normal.inv(power, 0, 1);
    const d = effectSizeD > 0 ? effectSizeD : 0.6;
    const eta2 = effectSizeEta2 > 0 && effectSizeEta2 < 1 ? effectSizeEta2 : 0.08;
    const groupKeys = Object.keys(groups).filter((k) => groups[k].length > 0);
    const k = Math.max(2, groupKeys.length || 2);
    const nT = Math.ceil((2 * Math.pow(zAlpha + zBeta, 2)) / Math.pow(d, 2));
    const f = Math.sqrt(eta2 / (1 - eta2));
    const nTotal = Math.ceil(((Math.pow(zAlpha + zBeta, 2)) * (k - 1)) / (k * Math.pow(f, 2)) + k);
    return { tTestPerGroup: nT, anovaPerGroup: Math.ceil(nTotal / k) };
  }, [groups, effectSizeD, effectSizeEta2]);

  const doseFit = useMemo(() => {
    if (dataType !== "dose-response" || !tidyRows || !mapping.concentration || !responseColumn) return null;
    const x: number[] = [];
    const y: number[] = [];
    tidyRows.forEach((row) => {
      const xv = safeNumeric((row as any)[mapping.concentration!]);
      const yv = safeNumeric((row as any)[responseColumn]);
      if (xv !== null && yv !== null) {
        x.push(xv);
        y.push(yv);
      }
    });
    if (x.length < 4) return null;
    return fit4PL(x, y, { fixTop: fixTopEnabled ? fixTopValue : null, fixBottom: fixBottomEnabled ? fixBottomValue : null, rout: routEnabled });
  }, [dataType, tidyRows, mapping.concentration, responseColumn, fixTopEnabled, fixTopValue, fixBottomEnabled, fixBottomValue, routEnabled]);

  const doseDroppedValues = useMemo(() => {
    if (!doseFit || !doseFit.dropped?.length || !tidyRows || !mapping.concentration || !responseColumn) return [] as Array<{ x: number; y: number }>;
    const xs: number[] = [];
    const ys: number[] = [];
    tidyRows.forEach((row) => {
      const xv = safeNumeric((row as any)[mapping.concentration!]);
      const yv = safeNumeric((row as any)[responseColumn]);
      if (xv !== null && yv !== null) {
        xs.push(xv);
        ys.push(yv);
      }
    });
    return doseFit.dropped
      .map((idx) => ({ x: xs[idx], y: ys[idx] }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) as Array<{ x: number; y: number }>;
  }, [doseFit, tidyRows, mapping.concentration, responseColumn]);

  const twAnova = useMemo(() => {
    if (!tidyRows || !responseColumn || !mapping.factorA || !mapping.factorB) return null;
    return twoWayANOVA(tidyRows, responseColumn, mapping.factorA, mapping.factorB);
  }, [tidyRows, responseColumn, mapping.factorA, mapping.factorB]);

  const twAnovaResult = useMemo(() => {
    if (!twAnova) return null;
    const simple = twAnova.pAB < 0.05 ? "Consider simple-effects: compare levels of Factor A within each level of Factor B, and vice versa." : "Interaction not significant; main effects interpretation is appropriate.";
    const adjustedSimple = twAnova.simpleEffects?.length ? (() => {
      const pAdj = adjustPValues(twAnova.simpleEffects.map((s) => s.p), pAdjustMethod);
      return twAnova.simpleEffects.map((s, idx) => ({ ...s, pAdj: pAdj[idx] }));
    })() : [] as typeof twAnova.simpleEffects;
    return { ...twAnova, simple, adjustedSimple: adjustedSimple || [], valid: true } as (ReturnType<typeof twoWayANOVA> & { simple: string; adjustedSimple: typeof twAnova.simpleEffects; valid: boolean });
  }, [twAnova, pAdjustMethod]);

  const tidyPreview = useMemo(() => formatPreview(tidyRows || []), [tidyRows]);
  const rawPreview = useMemo(() => formatPreview(rawRows || []), [rawRows]);

  return (
    <main className="calc-page" style={{ maxWidth: 1220 }}>
      <header className="calc-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="badge" style={{ marginBottom: 8 }}>Standalone • Statistical Analysis Suite</div>
            <h1 style={{ margin: 0 }}>Statistical Analysis for Wet Lab Scientists</h1>
            <p style={{ marginTop: 6, maxWidth: 880 }}>
              End-to-end diagnostics, decision trees, and visualizations. Data ingestion honors plate maps, auto-tidies wide well data, and maps Treatment / Concentration / Biological & Technical replicates for you.
            </p>
          </div>
          <button className="btn-primary" onClick={loadSamplePlate} aria-label="Load sample plate data">
            Load sample plate
          </button>
          <button className="btn-primary" onClick={() => setStatus("Working on upgrades…")}>Show progress</button>
        </div>
      </header>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>1) Upload data</div>
            <p style={{ marginTop: 0 }}>Accepts CSV, Excel, or plate maps. Plate-shaped files are reshaped with wellmap-style logic.</p>
            <label
              htmlFor="file-input"
              style={{
                border: "1px dashed rgba(173, 196, 224, 0.9)",
                borderRadius: 12,
                padding: 16,
                display: "block",
                cursor: "pointer",
                background: "rgba(255,255,255,0.85)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 700 }}>Drag & drop or click to upload</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>(CSV, Excel, plate maps)</div>
              </div>
              <input
                id="file-input"
                type="file"
                accept=".csv,.xls,.xlsx,text/csv,text/plain"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) parseFile(file);
                }}
              />
            </label>
            {status ? <div style={{ marginTop: 8, color: "#14532d", fontWeight: 700 }}>{status}</div> : null}
            {error ? <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 700 }}>Error: {error}</div> : null}
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Quick sample datasets</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => loadScenario(sampleTwoGroupNormal, "continuous")}>
                2-group normal (t-test path)
              </button>
              <button onClick={() => loadScenario(sampleMultiGroupNormal, "continuous")}>
                3-group normal (ANOVA path)
              </button>
              <button onClick={() => loadScenario(sampleNonNormal, "continuous")}>
                2-group non-normal (non-parametric path)
              </button>
              <button onClick={() => loadScenario(sampleDoseResponse, "dose-response")}>
                Dose-response (4PL)
              </button>
            </div>
          </div>

          {headers.length > 0 ? (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>2) Auto-detected experimental columns (editable)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Treatment</label>
                  <select
                    value={mapping.treatment || ""}
                    onChange={(e) => handleMappingChange("treatment", e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">-- None --</option>
                    {availableColumns.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Concentration</label>
                  <select
                    value={mapping.concentration || ""}
                    onChange={(e) => handleMappingChange("concentration", e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">-- None --</option>
                    {availableColumns.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Biological Replicate</label>
                  <select
                    value={mapping.bioReplicate || ""}
                    onChange={(e) => handleMappingChange("bioReplicate", e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">-- None --</option>
                    {availableColumns.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Technical Replicate</label>
                  <select
                    value={mapping.techReplicate || ""}
                    onChange={(e) => handleMappingChange("techReplicate", e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">-- None --</option>
                    {availableColumns.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Response / Readout</label>
                  <select
                    value={responseColumn || ""}
                    onChange={(e) => handleMappingChange("response", e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">-- None --</option>
                    {numericColumns.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Data type</label>
              <select value={dataType} onChange={(e) => setDataType(e.target.value as any)} style={{ width: "100%" }}>
                <option value="continuous">Continuous outcome</option>
                <option value="dose-response">Dose-response (4PL)</option>
                <option value="survival">Survival (KM)</option>
                <option value="correlation">Correlation / Regression</option>
                <option value="categorical">Categorical (counts)</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Sample relationship</label>
              <select value={independence} onChange={(e) => setIndependence(e.target.value as any)} style={{ width: "100%" }}>
                <option value="independent">Independent groups</option>
                <option value="paired">Paired / matched</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Transformation</label>
              <select value={transformMode} onChange={(e) => setTransformMode(e.target.value as any)} style={{ width: "100%" }}>
                <option value="none">None</option>
                <option value="log10">Log10 (drops ≤0; reported below)</option>
                <option value="sqrt">Square Root (drops &lt;0; reported below)</option>
                <option value="arcsin">Arcsine (proportions 0–1; drops outside range)</option>
              </select>
              {transformDropped.totalDropped > 0 ? (
                <div style={{ marginTop: 6, fontSize: 12, color: "#b45309" }}>
                  {transformDropped.totalDropped} value(s) excluded by transform: {(transformDropped.entries || []).filter((e) => e.dropped > 0).map((e) => `${e.group}: ${e.dropped}`).join(", ")}
                </div>
              ) : null}
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>p-adjust method (simple effects)</label>
              <select value={pAdjustMethod} onChange={(e) => setPAdjustMethod(e.target.value as PAdjustMethod)} style={{ width: "100%" }}>
                <option value="none">None</option>
                <option value="bonferroni">Bonferroni</option>
                <option value="holm">Holm</option>
                <option value="bh">Benjamini-Hochberg (FDR)</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Units (for axes/legends)</label>
              <input value={units} onChange={(e) => setUnits(e.target.value)} style={{ width: "100%" }} />
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, marginRight: 6 }}>Notation</label>
                <select value={unitNotation} onChange={(e) => setUnitNotation(e.target.value as "parentheses" | "slash")} style={{ width: "100%" }}>
                  <option value="parentheses">Parentheses (Response (ug/mL))</option>
                  <option value="slash">Slash (Response / ug/mL)</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>qPCR Target Ct</label>
              <select value={mapping.targetCt || ""} onChange={(e) => handleMappingChange("targetCt", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>qPCR Housekeeping Ct</label>
              <select value={mapping.housekeepingCt || ""} onChange={(e) => handleMappingChange("housekeepingCt", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>qPCR efficiencies (E)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" step="0.01" value={effTarget} onChange={(e) => setEffTarget(Number(e.target.value) || 2)} style={{ width: "50%" }} placeholder="Target E (e.g., 1.9)" />
                <input type="number" step="0.01" value={effRef} onChange={(e) => setEffRef(Number(e.target.value) || 2)} style={{ width: "50%" }} placeholder="Ref E (e.g., 1.95)" />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Control label (ΔΔCt reference)</label>
              <input value={controlLabel} onChange={(e) => setControlLabel(e.target.value || "Control")} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Survival Time</label>
              <select value={mapping.time || ""} onChange={(e) => handleMappingChange("time", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Survival Status (1=event,0=censored)</label>
              <select value={mapping.status || ""} onChange={(e) => handleMappingChange("status", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Factor A (Two-way)</label>
              <select value={mapping.factorA || ""} onChange={(e) => handleMappingChange("factorA", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Factor B (Two-way)</label>
              <select value={mapping.factorB || ""} onChange={(e) => handleMappingChange("factorB", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Dunnett control label</label>
              <input value={dunnettControl} onChange={(e) => setDunnettControl(e.target.value)} style={{ width: "100%" }} placeholder="Control group name" />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Correlation X</label>
              <select value={mapping.xVar || ""} onChange={(e) => handleMappingChange("xVar", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Correlation Y</label>
              <select value={mapping.yVar || ""} onChange={(e) => handleMappingChange("yVar", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Categorical A (rows)</label>
              <select value={mapping.catA || ""} onChange={(e) => handleMappingChange("catA", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Categorical B (cols)</label>
              <select value={mapping.catB || ""} onChange={(e) => handleMappingChange("catB", e.target.value)} style={{ width: "100%" }}>
                <option value="">-- None --</option>
                {availableColumns.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Raw preview</div>
            {rawPreview.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No data loaded yet.</div>
            ) : (
              <div style={{ overflow: "auto" }}>
                <table className="calc-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th key={`raw-${h}`} style={{ padding: "8px 10px", textAlign: "left", fontSize: 13 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawPreview.map((row, idx) => (
                      <tr key={`raw-row-${idx}`}>
                        {headers.map((h) => (
                          <td key={`raw-${idx}-${h}`} style={{ padding: "8px 10px", fontSize: 13 }}>{String(row[h] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Tidy preview</div>
            {tidyPreview.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No tidy data yet.</div>
            ) : (
              <div style={{ overflow: "auto" }}>
                <table className="calc-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {Object.keys(tidyPreview[0]).map((h) => (
                        <th key={`tidy-${h}`} style={{ padding: "8px 10px", textAlign: "left", fontSize: 13 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tidyPreview.map((row, idx) => (
                      <tr key={`tidy-row-${idx}`}>
                        {Object.keys(tidyPreview[0]).map((h) => (
                          <td key={`tidy-${idx}-${h}`} style={{ padding: "8px 10px", fontSize: 13 }}>{String((row as any)[h] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Automated diagnostic suite</div>
        {diagnostics ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #d9e4f2" }}>
              <div style={{ fontWeight: 700 }}>Normality (Shapiro-Wilk)</div>
              <div>Pooled (screening): W = {diagnostics.normal.w.toFixed(3)}, p = {diagnostics.normal.p.toPrecision(3)}</div>
              <div style={{ marginTop: 4, color: diagnostics.normal.p > 0.05 ? "#14532d" : "#b91c1c" }}>
                {diagnostics.normal.p > 0.05 ? "Normality not rejected (pooled)." : "Normality rejected (pooled p ≤ 0.05)."}
              </div>
              {diagnostics.transformedNormal ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontWeight: 600 }}>After log10 (pooled):</div>
                  <div>W = {diagnostics.transformedNormal.w.toFixed(3)}</div>
                  <div>p = {diagnostics.transformedNormal.p.toPrecision(3)}</div>
                </div>
              ) : null}
              {diagnostics.perGroupNormal?.length ? (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  Per-group normality:
                  <ul style={{ margin: "4px 0 0 14px", padding: 0 }}>
                    {(diagnostics.perGroupNormal || []).map((g) => (
                      <li key={`norm-${g.group}`}>{g.group}: W={g.w.toFixed(3)}, p={g.p.toPrecision(3)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #d9e4f2" }}>
              <div style={{ fontWeight: 700 }}>Variance (Levene)</div>
              {diagnostics.varianceCheck ? (
                <>
                  <div>F = {diagnostics.varianceCheck.f.toFixed(3)}</div>
                  <div>p = {diagnostics.varianceCheck.p.toPrecision(3)}</div>
                  <div style={{ marginTop: 4, color: diagnostics.varianceCheck.p > 0.05 ? "#14532d" : "#b91c1c" }}>
                    {diagnostics.varianceCheck.p > 0.05 ? "Homogeneity supported." : "Variances differ (p ≤ 0.05)."}
                  </div>
                </>
              ) : (
                <div>Needs ≥2 groups.</div>
              )}
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #d9e4f2" }}>
              <div style={{ fontWeight: 700 }}>Independence</div>
              <div>{independence === "independent" ? "Assuming independent groups." : "Paired / matched samples specified."}</div>
              <div style={{ marginTop: 4, color: "#0f172a" }}>
                Confirm design: biological replicates should be independent; technical replicates are nested within biological replicates.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "#6b7280" }}>Load data to run diagnostics.</div>
        )}
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Statistical decision tree</div>
        {decision ? (
          <div style={{ lineHeight: 1.6 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{decision.test}</div>
            <div style={{ marginTop: 4 }}>{decision.rationale}</div>
            {decision.resultSummary ? (
              <div style={{ marginTop: 6, fontWeight: 700 }}>Result: {decision.resultSummary}</div>
            ) : null}
            {totalBioN > 0 && totalBioN < 10 ? (
              <div style={{ marginTop: 8, color: "#92400e", background: "#fef3c7", padding: "6px 8px", borderRadius: 8, fontSize: 13 }}>
                Small sample size detected (n &lt; 10 biological replicates). Formal normality tests may be unreliable. Inspect the Q-Q plot; if points track the diagonal, parametric tests are likely valid.
              </div>
            ) : null}
            {decision.test === "Log10 transform + re-test" || decision.test === "Log10 transform + ANOVA/parametric retest" ? (
              <div style={{ marginTop: 6 }}>Apply log10 to positive values, rerun diagnostics, then proceed with parametric test if assumptions pass; otherwise stay with non-parametric path.</div>
            ) : null}
          </div>
        ) : (
          <div style={{ color: "#6b7280" }}>Decision tree will activate once data and mappings are set.</div>
        )}
      </section>

      {sortedKeys.length ? (
        <section className="calc-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Ordering (drag to reorder groups/legend)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sortedKeys.map((k, idx) => (
              <div
                key={`order-${k}`}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleGroupDrop(idx)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px dashed #94a3b8",
                  background: "#f8fafc",
                  cursor: "grab",
                  minWidth: 80,
                  textAlign: "center",
                  userSelect: "none",
                }}
                title="Drag to reorder"
              >
                {idx + 1}. {k || "(missing)"}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>Order applies to group displays and legends.</div>
        </section>
      ) : null}

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Visualizations (colorblind-safe, ≥8 pt fonts)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <div ref={superplotRef} style={{ background: "#0b1026", borderRadius: 14, padding: 12, color: "#e5e7eb", position: "relative" }}>
            <div style={{ position: "absolute", top: 8, left: 8, fontWeight: 800, fontSize: 12 }}>A</div>
            <div style={{ fontWeight: 800, marginBottom: 6, paddingLeft: 18 }}>SuperPlot</div>
            <div style={{ height: 220 }}>
              <Scatter
                data={(() => ({
                  labels: sortedKeys,
                  datasets: [
                    {
                      label: formatUnitsLabel("Technical reps"),
                      data: (() => {
                        const pts: any[] = [];
                        sortedKeys.forEach((k, idx) => {
                          const bioBuckets = techByGroupBio[k] || {};
                          Object.values(bioBuckets).forEach((vals) => {
                            vals.forEach((v) => {
                              pts.push({ x: idx + (Math.random() - 0.5) * 0.14, y: v });
                            });
                          });
                        });
                        return pts;
                      })(),
                      pointRadius: 4,
                      backgroundColor: ((len:number) => {
                        const palette = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"];
                        return Array.from({length: len}, (_, i) => palette[i % palette.length]);
                      })(sortedKeys.reduce((sum,k)=>{const b=techByGroupBio[k]||{};return sum+Object.values(b).reduce((s,v)=>s+v.length,0);},0)),
                    },
                    {
                      label: formatUnitsLabel("Biological means"),
                      data: (() => {
                        const pts: any[] = [];
                        sortedKeys.forEach((k, idx) => {
                          const bioMeans = bioMeansByGroup[k] || groups[k] || [];
                          bioMeans.forEach((bm) => pts.push({ x: idx, y: bm }));
                        });
                        return pts;
                      })(),
                      pointRadius: 8,
                      pointStyle: "triangle",
                      backgroundColor: ((len:number) => {
                        const palette = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"];
                        return Array.from({length: len}, (_, i) => palette[i % palette.length]);
                      })((bioMeansByGroup && Object.values(bioMeansByGroup).reduce((s,v)=>s+v.length,0)) || 0),
                    },
                  ],
                })) as any}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: {
                      type: "linear",
                      ticks: { color: "#cbd5e1", callback: (value) => sortedKeys[Number(value)] ?? value },
                      grid: { color: "rgba(255,255,255,0.15)" },
                      title: { display: true, text: mapping.treatment || "Group", color: "#e2e8f0", font: { size: 12 } },
                    },
                    y: {
                      ticks: { color: "#cbd5e1" },
                      grid: { color: "rgba(255,255,255,0.15)" },
                      title: { display: true, text: responseWithUnits, color: "#e2e8f0", font: { size: 12 } },
                    },
                  },
                  plugins: { legend: { position: "bottom", labels: { color: "#e5e7eb", font: { size: 11 } } } },
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => exportFigure(superplotRef, "superplot", "png", () => setExporting(null), () => setExporting("SuperPlot PNG"))}>Download PNG (high-res)</button>
              <button onClick={() => exportFigure(superplotRef, "superplot", "pdf", () => setExporting(null), () => setExporting("SuperPlot PDF"))}>Download PDF</button>
            </div>
          </div>

          <div ref={qqRef} style={{ background: "#0b1026", borderRadius: 14, padding: 12, color: "#e5e7eb", position: "relative" }}>
            <div style={{ position: "absolute", top: 8, left: 8, fontWeight: 800, fontSize: 12 }}>B</div>
            <div style={{ fontWeight: 800, marginBottom: 6, paddingLeft: 18 }}>Q-Q Plot</div>
            <div style={{ height: 220 }}>
              <Scatter
                data={(() => ({
                  datasets: [
                    {
                      label: "Sample vs theoretical",
                      data: diagnostics && diagnostics.qq ? diagnostics.qq.sample.map((v, idx) => ({ x: diagnostics.qq.theoretical[idx], y: v })) : [],
                      backgroundColor: "#1b9e77",
                      pointRadius: 4,
                    },
                  ],
                })) as any}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,0.15)" }, title: { display: true, text: "Theoretical quantiles", color: "#e2e8f0", font: { size: 12 } } },
                    y: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,0.15)" }, title: { display: true, text: "Sample quantiles", color: "#e2e8f0", font: { size: 12 } } },
                  },
                  plugins: { legend: { display: false } },
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => exportFigure(qqRef, "qq-plot", "png", () => setExporting(null), () => setExporting("Q-Q PNG"))}>Download PNG (high-res)</button>
              <button onClick={() => exportFigure(qqRef, "qq-plot", "pdf", () => setExporting(null), () => setExporting("Q-Q PDF"))}>Download PDF</button>
            </div>
          </div>

          <div ref={boxRef} style={{ background: "#0b1026", borderRadius: 14, padding: 12, color: "#e5e7eb", position: "relative" }}>
            <div style={{ position: "absolute", top: 8, left: 8, fontWeight: 800, fontSize: 12 }}>C</div>
            <div style={{ fontWeight: 800, marginBottom: 6, paddingLeft: 18 }}>Box & whisker</div>
            <div style={{ height: 220, display: "flex", alignItems: "flex-end", gap: 12 }}>
              {sortedKeys.map((k, idx) => {
                const vals = groups[k];
                const color = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"][idx % 8];
                if (!vals || vals.length === 0) return null;
                const sorted = [...vals].sort((a, b) => a - b);
                const q1 = quantile(sorted, 0.25);
                const q2 = quantile(sorted, 0.5);
                const q3 = quantile(sorted, 0.75);
                const iqr = q3 - q1;
                const lower = Math.max(Math.min(...sorted), q1 - 1.5 * iqr);
                const upper = Math.min(Math.max(...sorted), q3 + 1.5 * iqr);
                return (
                  <div key={k} style={{ flex: 1, textAlign: "center", fontSize: 12 }}>
                    <div style={{ height: 180, position: "relative" }}>
                      <div style={{ position: "absolute", bottom: `${((lower - lower) / (upper - lower + 1e-9)) * 160}px`, left: "50%", transform: "translateX(-50%)", width: 4, height: 2, background: "#e5e7eb" }} />
                      <div style={{ position: "absolute", bottom: `${((upper - lower) / (upper - lower + 1e-9)) * 160}px`, left: "50%", transform: "translateX(-50%)", width: 4, height: 2, background: "#e5e7eb" }} />
                      <div style={{ position: "absolute", bottom: `${((q1 - lower) / (upper - lower + 1e-9)) * 160}px`, left: "50%", transform: "translateX(-50%)", width: 32, height: `${((q3 - q1) / (upper - lower + 1e-9)) * 160}px`, background: color.replace("1)", "0.25)"), border: `1px solid ${color}` }} />
                      <div style={{ position: "absolute", bottom: `${((q2 - lower) / (upper - lower + 1e-9)) * 160}px`, left: "50%", transform: "translateX(-50%)", width: 36, height: 2, background: color }} />
                      <div style={{ position: "absolute", bottom: `${((upper - lower) / (upper - lower + 1e-9)) * 160}px`, left: "50%", width: 2, height: `${160}px`, background: "rgba(229,231,235,0.45)" }} />
                    </div>
                    <div style={{ marginTop: 6 }}>{k}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => exportFigure(boxRef, "boxplot", "png", () => setExporting(null), () => setExporting("Box PNG"))}>Download PNG (high-res)</button>
              <button onClick={() => exportFigure(boxRef, "boxplot", "pdf", () => setExporting(null), () => setExporting("Box PDF"))}>Download PDF</button>
            </div>
          </div>

          {dataType === "dose-response" ? (
            <div ref={doseRef} style={{ background: "#0b1026", borderRadius: 14, padding: 12, color: "#e5e7eb", position: "relative" }}>
              <div style={{ position: "absolute", top: 8, left: 8, fontWeight: 800, fontSize: 12 }}>D</div>
              <div style={{ fontWeight: 800, marginBottom: 6, paddingLeft: 18 }}>4PL dose-response</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6, paddingLeft: 18 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={fixBottomEnabled} onChange={(e) => setFixBottomEnabled(e.target.checked)} /> Fix Bottom to
                  <input type="number" value={fixBottomValue} onChange={(e) => setFixBottomValue(Number(e.target.value) || 0)} style={{ width: 90 }} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={fixTopEnabled} onChange={(e) => setFixTopEnabled(e.target.checked)} /> Fix Top to
                  <input type="number" value={fixTopValue} onChange={(e) => setFixTopValue(Number(e.target.value) || 100)} style={{ width: 90 }} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={routEnabled} onChange={(e) => setRoutEnabled(e.target.checked)} /> Automatic outlier detection (ROUT Q=1%)
                </label>
              </div>
              <div style={{ height: 220 }}>
                <Line
                  data={(() => {
                    const xs = tidyRows && mapping.concentration && responseColumn ? tidyRows
                      .map((row) => safeNumeric((row as any)[mapping.concentration!]))
                      .filter((v): v is number => v !== null)
                      .sort((a, b) => a - b) : [];
                    const ys = tidyRows && responseColumn ? tidyRows
                      .map((row) => safeNumeric((row as any)[responseColumn]))
                      .filter((v): v is number => v !== null) : [];
                    const curveX = xs.length ? Array.from({ length: 80 }, (_, i) => xs[0] + ((xs[xs.length - 1] - xs[0]) * i) / 79) : [];
                    const curveY = curveX.map((xv) => {
                      if (!doseFit) return null;
                      const { top, hill, ec50, bottom } = doseFit;
                      return bottom + (top - bottom) / (1 + Math.pow(xv / ec50, hill));
                    }).filter((v): v is number => v !== null);
                    return {
                      datasets: [
                        {
                          label: formatUnitsLabel("Observed"),
                          data: xs.map((xv, idx) => ({ x: xv, y: ys[idx] })).filter((d) => d.x !== null && d.y !== null),
                          pointRadius: 4,
                          borderColor: "transparent",
                          backgroundColor: "#60a5fa",
                        },
                        {
                          label: formatUnitsLabel("4PL fit"),
                          data: curveX.map((xv, idx) => ({ x: xv, y: curveY[idx] })),
                          borderColor: "#f97316",
                          backgroundColor: "rgba(249,115,22,0.15)",
                          fill: true,
                          tension: 0.25,
                          pointRadius: 0,
                        },
                      ],
                    } as any;
                  }) as any}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { type: "linear", ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,0.08)" }, title: { display: true, text: mapping.concentration || "Concentration", color: "#e2e8f0", font: { size: 12 } } },
                      y: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,0.08)" }, title: { display: true, text: responseWithUnits, color: "#e2e8f0", font: { size: 12 } } },
                    },
                    plugins: { legend: { position: "bottom", labels: { color: "#e5e7eb", font: { size: 11 } } } },
                  }}
                />
              </div>
              {doseFit ? (
                <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
                  EC50/IC50 = {doseFit.ec50.toPrecision(4)} (95% CI {doseFit.ci[0].toPrecision(3)}–{doseFit.ci[1].toPrecision(3)}); Hill = {doseFit.hill.toPrecision(3)}; Top = {doseFit.top.toPrecision(3)}; Bottom = {doseFit.bottom.toPrecision(3)}.
                  CI uses bootstrap (n up to 150 or 8× samples, min 40). Increase cap in code if you need tighter CIs; keep ≥30–40 observations for stability.
                  {doseFit.dropped && doseFit.dropped.length ? ` ROUT removed ${doseFit.dropped.length} point(s).` : ""}
                </div>
              ) : (
                <div style={{ marginTop: 8, color: "#cbd5e1" }}>Provide concentration + response to fit 4PL.</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={() => exportFigure(doseRef, "dose-response", "png", () => setExporting(null), () => setExporting("4PL PNG"))}>Download PNG (high-res)</button>
                <button onClick={() => exportFigure(doseRef, "dose-response", "pdf", () => setExporting(null), () => setExporting("4PL PDF"))}>Download PDF</button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {mapping.factorA && mapping.factorB ? (
        <section className="calc-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Two-way ANOVA (with interaction)</div>
          {twAnovaResult ? (
            twAnovaResult.valid ? (
              <div style={{ lineHeight: 1.6 }}>
                <div>Factor A: F({twAnovaResult.dfA}, {twAnovaResult.dfE}) = {twAnovaResult.FA.toFixed(2)}, {formatP(twAnovaResult.pA)}</div>
                <div>Factor B: F({twAnovaResult.dfB}, {twAnovaResult.dfE}) = {twAnovaResult.FB.toFixed(2)}, {formatP(twAnovaResult.pB)}</div>
                <div>Interaction: F({twAnovaResult.dfAB}, {twAnovaResult.dfE}) = {twAnovaResult.FAB.toFixed(2)}, {formatP(twAnovaResult.pAB)}</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>{twAnovaResult.simple}</div>
                {twAnovaResult.adjustedSimple?.length ? (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    Simple effects ({pAdjustMethod === "none" ? "no p-adjust" : `${pAdjustMethod} adjusted`}): {(twAnovaResult.adjustedSimple || []).map((se) => `${se.factor} within ${se.within}: F(${se.df1}, ${se.df2})=${se.F.toFixed(2)}, ${formatP((se as any).pAdj ?? se.p)}`).join("; ")}
                  </div>
                ) : null}
              </div>
            ) : <div style={{ color: "#6b7280" }}>Needs data with both factors present.</div>
          ) : <div style={{ color: "#6b7280" }}>Provide Factor A and Factor B to compute two-way ANOVA.</div>}
        </section>
      ) : null}

      {dataType === "survival" && survival ? (
        <section className="calc-card" style={{ marginBottom: 12 }} ref={kmRef}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Survival analysis (Kaplan-Meier)</div>
          {survival.logrank ? (
            <div style={{ lineHeight: 1.6, marginBottom: 8 }}>
              <div>Log-rank (overall) χ²({survival.logrank.df}) = {survival.logrank.chi.toFixed(2)}, {formatP(survival.logrank.p)}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Censored observations marked with crosses; curves are stepwise KM estimates.</div>
            </div>
          ) : <div style={{ color: "#6b7280" }}>Need ≥2 groups with Time and Status to run log-rank.</div>}
          <div style={{ height: 260 }}>
            <Line
              data={(() => {
                const palette = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#666666"];
                const datasets: any[] = [];
                const keyOrder = (() => {
                  const keys = Object.keys(survival?.grouped || {});
                  if (!groupOrder.length) return keys;
                  const existing = groupOrder.filter((k) => keys.includes(k));
                  const remaining = keys.filter((k) => !existing.includes(k));
                  return [...existing, ...remaining];
                })();
                keyOrder.forEach((k, idx) => {
                  const series = (survival?.grouped?.[k] ?? []).slice().sort((a, b) => a.time - b.time);
                  let atRisk = series.length;
                  let surv = 1;
                  const curve: Array<{ x: number; y: number }> = [{ x: 0, y: 1 }];
                  const censorPoints: Array<{ x: number; y: number }> = [];
                  series.forEach((pt) => {
                    if (pt.status === 1 && atRisk > 0) {
                      surv *= (1 - 1 / atRisk);
                    } else if (pt.status === 0) {
                      censorPoints.push({ x: pt.time, y: surv });
                    }
                    atRisk -= 1;
                    curve.push({ x: pt.time, y: surv });
                  });
                  datasets.push({
                    label: k,
                    data: curve,
                    borderColor: palette[idx % palette.length],
                    backgroundColor: "transparent",
                    stepped: true,
                    pointRadius: 0,
                    tension: 0,
                  });
                  datasets.push({
                    label: `${k} censored`,
                    data: censorPoints,
                    borderColor: "transparent",
                    backgroundColor: palette[idx % palette.length],
                    pointRadius: 4,
                    pointStyle: "crossRot",
                    showLine: false,
                  });
                });
                return { datasets };
              }) as any}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { type: "linear", ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,0.15)" }, title: { display: true, text: mapping.time || "Time", color: "#e2e8f0", font: { size: 12 } } },
                  y: { min: 0, max: 1, ticks: { color: "#cbd5e1" }, grid: { color: "rgba(255,255,255,0.15)" }, title: { display: true, text: "Survival", color: "#e2e8f0", font: { size: 12 } } },
                },
                plugins: { legend: { position: "bottom", labels: { color: "#e5e7eb", font: { size: 11 } } } },
              }}
            />
          </div>
        </section>
      ) : null}

      {qpcr ? (
        <section className="calc-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>qPCR (ΔΔCt) workflow</div>
          {qpcr.controlMissing ? (
            <div style={{ color: "#b91c1c" }}>No rows found for control label "{controlLabel}". Set Control label to match your reference group.</div>
          ) : (
            <>
              <div style={{ overflow: "auto" }}>
                <table className="calc-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 13 }}>Group</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 13 }}>Biological</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 13 }}>ΔCt (bio mean)</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 13 }}>ΔΔCt</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 13 }}>Fold change (2^-ΔΔCt)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(qpcr.table || []).map((r, idx) => (
                      <tr key={`ddct-${idx}`}>
                        <td style={{ padding: "8px 10px", fontSize: 13 }}>{r.group}</td>
                        <td style={{ padding: "8px 10px", fontSize: 13 }}>{r.bio}</td>
                        <td style={{ padding: "8px 10px", fontSize: 13 }}>{r.deltaCt.toFixed(3)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 13 }}>{(r as any).ddct?.toFixed(3)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 13 }}>{(r as any).fold?.toPrecision(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                {(qpcr.summary || []).map((s) => (
                  <div key={`sum-${s.group}`} style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #d9e4f2" }}>
                    <div style={{ fontWeight: 700 }}>{s.group}</div>
                    <div>ΔΔCt mean = {s.ddctMean.toFixed(3)} ± {s.ddctSd.toFixed(3)}</div>
                    <div>Fold change = {s.foldMean.toPrecision(4)} ± {s.foldSd.toPrecision(3)}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                Fold-change SD uses error propagation: σ_fold ≈ ln(E_target) × fold × σ_ΔΔCt (defaults to ln2). Bio replicates are averaged per bio unit before ΔΔCt.
              </div>
            </>
          )}
        </section>
      ) : null}

      {corrAnalysis ? (
        <section className="calc-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Correlation & Regression</div>
          <div style={{ lineHeight: 1.6 }}>
            {corrAnalysis.pear ? <div>Pearson r = {corrAnalysis.pear.r.toFixed(3)}, t({corrAnalysis.pear.df}) = {corrAnalysis.pear.t.toFixed(2)}, {formatP(corrAnalysis.pear.p)}</div> : <div style={{ color: "#6b7280" }}>Pearson needs ≥3 numeric pairs.</div>}
            {corrAnalysis.spear ? <div>Spearman ρ = {corrAnalysis.spear.r.toFixed(3)}, t({corrAnalysis.spear.df}) = {corrAnalysis.spear.t.toFixed(2)}, {formatP(corrAnalysis.spear.p)}</div> : null}
            {corrAnalysis.lin ? (
              <div>
                Linear regression: slope = {corrAnalysis.lin.slope.toPrecision(4)} [{corrAnalysis.lin.slopeCI[0].toPrecision(3)}, {corrAnalysis.lin.slopeCI[1].toPrecision(3)}]; intercept = {corrAnalysis.lin.intercept.toPrecision(4)}; R² = {corrAnalysis.lin.R2.toPrecision(3)}.
              </div>
            ) : null}
            {corrAnalysis.slopeHet ? (
              <div style={{ marginTop: 6 }}>
                Slope heterogeneity (pairwise): {(corrAnalysis.slopeHet.comparisons || []).map((c) => `${c.a} vs ${c.b}: Δ=${c.diff.toPrecision(4)}, t(${c.df.toFixed(1)})=${c.t.toFixed(2)}, ${formatP(c.p)}`).join("; ")}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {catAnalysis ? (
        <section className="calc-card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Categorical tests</div>
          {catAnalysis.kind === "fisher" ? (
            <div>Fisher's exact (2×2): {formatP(catAnalysis.fisher.p)}</div>
          ) : (
            <div>Chi-square (r×c): χ²({catAnalysis.chi.df}) = {catAnalysis.chi.chi.toFixed(2)}, {formatP(catAnalysis.chi.p)}</div>
          )}
          <div style={{ marginTop: 6, fontSize: 13 }}>Table rows = {catAnalysis.rows.join(", ")}; cols = {catAnalysis.cols.join(", ")}.</div>
        </section>
      ) : null}

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>qPCR standard curve (derive efficiency)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
          <textarea
            value={stdCurveInput}
            onChange={(e) => setStdCurveInput(e.target.value)}
            placeholder="Paste two columns: Concentration,Cq"
            style={{ minHeight: 120 }}
          />
          <button className="btn-primary" onClick={() => {
            try {
              const lines = stdCurveInput.split(/\n+/).map((l) => l.trim()).filter(Boolean);
              const conc: number[] = [];
              const cq: number[] = [];
              lines.forEach((ln) => {
                const [c, q] = ln.split(/[,\s]+/);
                const cv = Number(c);
                const qv = Number(q);
                if (Number.isFinite(cv) && Number.isFinite(qv)) {
                  conc.push(cv);
                  cq.push(qv);
                }
              });
              if (conc.length < 3) throw new Error("Need ≥3 points");
              const logc = conc.map((v) => Math.log10(v));
              const reg = linearRegression(logc, cq);
              if (!reg) throw new Error("Failed regression");
              if (reg.slope >= 0) throw new Error("Slope should be negative (Cq should increase with dilution)");
              const eff = Math.pow(10, -1 / reg.slope);
              setStandardCurveE(eff);
              setStdCurveStatus(`Derived E = ${eff.toPrecision(3)} (slope=${reg.slope.toPrecision(4)}, R²=${reg.R2.toPrecision(3)})`);
            } catch (err: any) {
              setStandardCurveE(null);
              setStdCurveStatus(err?.message || "Failed to derive efficiency");
            }
          }}>Compute efficiency</button>
          <button onClick={() => {
            setStdCurveInput(sampleStdCurve);
            setStdCurveStatus("Loaded demo standard curve (5-point 10-fold dilutions)");
            setStandardCurveE(null);
          }}>Load demo standard curve</button>
        </div>
        {standardCurveE ? <div style={{ marginTop: 6 }}>{stdCurveStatus || `Derived E = ${standardCurveE.toPrecision(3)}`}</div> : <div style={{ marginTop: 6, color: "#6b7280" }}>{stdCurveStatus || "Provide dilution series to derive efficiency."}</div>}
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Layout canvas</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          {Object.entries(layoutRefs).map(([k, v]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={v} onChange={(e) => setLayoutRefs((prev) => ({ ...prev, [k]: e.target.checked }))} /> Include {k}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={() => exportLayoutPdf({ superplot: superplotRef, qq: qqRef, box: boxRef, dose: doseRef, km: kmRef }, () => setExporting(null), () => setExporting("Layout PDF"))}>Export layout (PDF)</button>
        </div>
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Power analysis (a priori)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #d9e4f2" }}>
            <div style={{ fontWeight: 700 }}>t-test (Cohen's d)</div>
            <div>Target power 0.80, α = 0.05 (two-tailed)</div>
            <div style={{ marginTop: 6, fontWeight: 700 }}>Required n per group ≈ {powerEstimates.tTestPerGroup}</div>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Effect size d</label>
              <input
                type="number"
                step="0.05"
                min="0.01"
                value={effectSizeD}
                onChange={(e) => setEffectSizeD(Number(e.target.value) || 0.6)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #d9e4f2" }}>
            <div style={{ fontWeight: 700 }}>ANOVA (η² → Cohen's f)</div>
            <div>Target power 0.80, α = 0.05</div>
            <div style={{ marginTop: 6, fontWeight: 700 }}>Required n per group ≈ {powerEstimates.anovaPerGroup}</div>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>η² (0-1)</label>
              <input
                type="number"
                step="0.01"
                min="0.001"
                max="0.6"
                value={effectSizeEta2}
                onChange={(e) => setEffectSizeEta2(Number(e.target.value) || 0.08)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
          Assumes balanced groups. Adjust effect sizes (d, η²) to match your experiment; defaults set to moderate (d ≈ 0.6, η² ≈ 0.08).
          Guidance: d ≈ 0.2 (small), 0.5–0.7 (moderate), ≥0.8 (large); η² ≈ 0.02 (small), 0.06–0.10 (moderate), ≥0.14 (large).
        </div>
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Methods text</div>
        <button className="btn-primary" onClick={() => {
          const normalText = diagnostics ? (diagnostics.normal.p > 0.05 ? "Normality was assessed via Shapiro-Wilk (P > 0.05)." : "Normality was assessed via Shapiro-Wilk.") : "Normality was assessed via Shapiro-Wilk.";
          const corr = decision?.test?.includes("Welch") ? "Welch's correction was applied for unequal variances." : "Assumes equal variance.";
          const statText = decision?.resultSummary ? `Test statistic(s): ${decision.resultSummary}.` : "";
          const txt = `Data were analyzed with ${decision?.test || "appropriate statistical tests"}. ${normalText} Variance was checked with Levene's test. ${corr} ${statText} All n values represent independent biological replicates (technical replicates averaged per biological unit). Analysis was performed using version 1.0.`;
          setMethodsText(txt);
        }}>Export Methods Text</button>
        {methodsText ? (
          <textarea style={{ width: "100%", marginTop: 8, minHeight: 140 }} value={methodsText} readOnly />
        ) : null}
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => tidyExport(tidyBio, "tidy_biological_means.csv")} className="btn-primary">Download Tidy Data (CSV)</button>
          <button onClick={() => {
            const welchFootnote = "Pairwise comparisons to control performed via Welch's t-test (Dunnett uses a joint distribution; we surface the actual method used).";
            const effectLine = decision?.resultSummary ? `Effect sizes / estimates: ${decision.resultSummary}` : "";
            const parts = [
              methodsText || "",
              effectLine,
              decision?.resultSummary ? `Decision: ${decision.resultSummary}` : "",
              corrAnalysis ? `Correlation: ${corrAnalysis.pear ? `Pearson r=${corrAnalysis.pear.r.toFixed(3)} ${formatP(corrAnalysis.pear.p)}` : ""} ${corrAnalysis.lin ? `; slope=${corrAnalysis.lin.slope.toPrecision(4)} R2=${corrAnalysis.lin.R2.toPrecision(3)}` : ""}` : "",
              catAnalysis ? (catAnalysis.kind === "fisher" ? `Fisher exact p=${catAnalysis.fisher.p.toPrecision(3)}` : `Chi-square chi2=${catAnalysis.chi.chi.toFixed(2)} df=${catAnalysis.chi.df} p=${catAnalysis.chi.p.toPrecision(3)}`) : "",
              doseFit ? (() => {
                const droppedText = doseFit.dropped?.length
                  ? `; ROUT dropped ${doseFit.dropped.length} point(s)`
                  : "";
                const droppedVals = doseDroppedValues.length
                  ? ` (dropped values: ${doseDroppedValues.map((p) => `x=${p.x}, y=${p.y}`).join("; ")})`
                  : "";
                return `4PL: EC50=${doseFit.ec50.toPrecision(4)} CI[${doseFit.ci[0].toPrecision(3)},${doseFit.ci[1].toPrecision(3)}]${droppedText}${droppedVals}`;
              })() : "",
              survival?.logrank ? `KM log-rank: chi2(${survival.logrank.df})=${survival.logrank.chi.toFixed(2)} ${formatP(survival.logrank.p)}` : "",
              welchFootnote,
            ];
            const blob = new Blob([parts.filter(Boolean).join("\n")], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "analysis_report.txt";
            link.click();
            exportReportPdf(parts.filter(Boolean), () => setExporting(null), () => setExporting("Analysis Report"));
          }} className="btn-primary">Export Analysis Report (txt/PDF)</button>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>
          Pairwise comparisons to control performed via Welch's t-test (Dunnett uses a joint distribution; this labels the actual method used).
        </div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
          <textarea
            value={miqeText}
            onChange={(e) => setMiqeText(e.target.value)}
            placeholder="MIQE draft checklist"
            style={{ minHeight: 120 }}
          />
          <button className="btn-primary" onClick={() => {
            const nBio = Object.values(groups).reduce((s, a) => s + a.length, 0);
            const template = [
              "MIQE Draft:",
              "• Template preparation: cDNA from RNA (DNase treated); reverse transcription kit noted.",
              `• Standard curve efficiency (E): ${standardCurveE ? standardCurveE.toPrecision(3) : effTarget} (derived from standard curve).`,
              "• Standard curve range: 10-fold serial dilutions (provide Ct vs log10 input).",
              `• Target gene Ct column: ${mapping.targetCt || "(not set)"}. Housekeeping gene Ct: ${mapping.housekeepingCt || "(not set)"}.`,
              "• Reference gene validation: stability assumed; document M-values or prior validation if available.",
              "• Reaction details: chemistry (SYBR/probe), master mix, primer/probe sequences, amplicon length, GC%, melt curve confirmed (if SYBR).",
              "• Replicates: technical replicates averaged to biological means; report n per group.",
              `• Biological replicates (n): ${nBio || "(not set)"}. Technical n per bio: ${mapping.techReplicate || "(column not mapped)"}.`,
              `• Control/Calibrator: ${controlLabel || "Control"}.`,
              "• No-template/no-RT controls: include and confirm no amplification.",
              `• Analysis: ΔΔCt using control '${controlLabel || "Control"}'; efficiencies E_target=${effTarget.toPrecision(3)}, E_ref=${effRef.toPrecision(3)} (edit if known).`,
              "• Data handling: outliers? (specify rule if applied).",
            ];
            setMiqeText(template.join("\n"));
          }}>Auto-fill MIQE</button>
          <textarea
            value={arriveText}
            onChange={(e) => setArriveText(e.target.value)}
            placeholder="ARRIVE draft checklist"
            style={{ minHeight: 120 }}
          />
          <button className="btn-primary" onClick={() => {
            const nBio = Object.values(groups).reduce((s, a) => s + a.length, 0);
            const template = [
              "ARRIVE Draft:",
              `• Groups/treatments: ${mapping.treatment || "(treatment not set)"}.`,
              "• Objectives/hypotheses: (describe primary outcome and effect direction).",
              "• Ethical statement: (protocol ID / approval body).",
              "• Randomization: (method if used; otherwise state not randomised).",
              "• Blinding: (who was blinded; if not, state not blinded).",
              `• Sample size justification: biological n = ${nBio || "(not set)"}; technical replicates averaged per bio unit.`,
              `• Inclusion/exclusion: (criteria; report any excluded samples).`,
              `• Outcome measures: ${responseColumn || "(not set)"}.`,
              "• Statistical methods: as selected above (ANOVA/t-tests/non-parametric/4PL, etc.).",
              "• Experimental animals: species/strain/sex/age/weight; housing and husbandry (light/diet/enrichment).",
              "• Experimental procedures: dose/route/timing; surgical/anesthesia/analgesia if applicable.",
              "• Adverse events: (report if any).",
            ];
            setArriveText(template.join("\n"));
          }}>Auto-fill ARRIVE</button>
        </div>
      </section>

      <section className="calc-card">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Export & annotation protocol</div>
        <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Default visual: SuperPlots (technical replicates as dots; biological means as symbols).</li>
          <li>Secondary visuals: box/whisker and dose-response (4PL) with CI band.</li>
          <li>Significance annotation: use brackets + asterisks (* p ≤ 0.05, ** p ≤ 0.01, *** p ≤ 0.001, **** p ≤ 0.0001). For publication, display exact p-values (P ≥ 0.001) on brackets.</li>
          <li>Style: Seaborn "ticks"-inspired high-contrast palette; font sizes ≥ 8 pt; panel labels (A/B/C/D) are 12 pt bold.</li>
          <li>Exports: each figure provides TIFF (simulated 600 DPI via high-resolution render) and PDF download links.</li>
          <li>Rationale examples are shown inline whenever a test is selected (e.g., Mann-Whitney chosen when normality is violated).</li>
        </ul>
      </section>
    </main>
  );
}
