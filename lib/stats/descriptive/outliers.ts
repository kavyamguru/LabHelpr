import { AnalysisRow, OutlierFlag } from "./types";

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

export function flagOutliers(rows: AnalysisRow[]): OutlierFlag[] {
  const byGroup = new Map<string, AnalysisRow[]>();
  rows.forEach((r) => {
    if (r.response === null) return;
    const key = r.group ?? "(unlabeled)";
    const list = byGroup.get(key) || [];
    list.push(r);
    byGroup.set(key, list);
  });

  const flags: OutlierFlag[] = [];
  byGroup.forEach((groupRows, groupKey) => {
    const values = groupRows.map((r) => r.response as number).sort((a, b) => a - b);
    if (values.length < 4) return; // too small to flag reliably
    const q1 = quantile(values, 0.25)!;
    const q3 = quantile(values, 0.75)!;
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    groupRows.forEach((r) => {
      const v = r.response as number;
      if (v < lower || v > upper) {
        flags.push({
          rowIndex: r.rawRowIndex,
          group: r.group,
          value: v,
          method: "iqr",
          threshold: v < lower ? lower : upper,
        });
      }
    });
  });

  return flags;
}
