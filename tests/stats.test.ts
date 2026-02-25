import { describe, it, expect } from "vitest";
import {
  applyTransform,
  computeGroupStats,
  computeFoldChanges,
  RawRow,
  ComputeOptions,
} from "../lib/stats/descriptive";
import { formatNumber, defaultFormat } from "../lib/stats/formatting";

const baseOptions: ComputeOptions = {
  replicateType: "biological",
  technicalHandling: "average",
  missingHandling: "ignore",
  transform: "none",
  allowNonPositiveLog: false,
  varianceConvention: "sample",
  iqrMultiplier: 1.5,
  ciMethod: "t95",
};

function rowsA(): RawRow[] {
  return [
    { rowId: 0, group: "A", rawValue: "1", value: 1, issues: [] },
    { rowId: 1, group: "A", rawValue: "2", value: 2, issues: [] },
    { rowId: 2, group: "A", rawValue: "3", value: 3, issues: [] },
  ];
}

function rowsAB(): RawRow[] {
  return [
    { rowId: 0, group: "A", rawValue: "2", value: 2, issues: [] },
    { rowId: 1, group: "A", rawValue: "2", value: 2, issues: [] },
    { rowId: 2, group: "B", rawValue: "4", value: 4, issues: [] },
    { rowId: 3, group: "B", rawValue: "4", value: 4, issues: [] },
  ];
}

describe("descriptive stats", () => {
  it("computes mean/median/SD/variance sample vs population", () => {
    const { stats: sampleStats } = computeGroupStats(rowsA(), { ...baseOptions, varianceConvention: "sample" });
    const gSample = sampleStats[0];
    expect(gSample.mean).toBeCloseTo(2, 10);
    expect(gSample.median).toBeCloseTo(2, 10);
    expect(gSample.sd).toBeCloseTo(Math.sqrt(1), 10); // sample variance = 1
    expect(gSample.variance).toBeCloseTo(1, 10);

    const { stats: popStats } = computeGroupStats(rowsA(), { ...baseOptions, varianceConvention: "population" });
    const gPop = popStats[0];
    expect(gPop.variance).toBeCloseTo(2 / 3, 10); // population variance
    expect(gPop.sd).toBeCloseTo(Math.sqrt(2 / 3), 10);
  });

  it("computes t-based 95% CI with correct df", () => {
    const { stats } = computeGroupStats(rowsA(), baseOptions);
    const g = stats[0];
    expect(g.ci95).toBeTruthy();
    expect(g.ci95?.df).toBe(2);
    // mean=2, sd=1, sem=1/sqrt(3); width ~ 4.30265*sem
    const expectedWidth = 4.30265 * (1 / Math.sqrt(3));
    expect(Math.abs((g.ci95!.high - g.ci95!.low) / 2 - expectedWidth)).toBeLessThan(1e-3);
  });

  it("excludes non-positive values on log transform", () => {
    const res = applyTransform([1, 0, -1, 4], "log2", false);
    expect(res.values.length).toBe(2);
    expect(res.excluded.length).toBe(2);
    expect(res.warning).toBeTruthy();
  });

  it("computes fold and % change correctly", () => {
    const { stats } = computeGroupStats(rowsAB(), baseOptions);
    const fcs = computeFoldChanges(stats, "A");
    expect(fcs.length).toBe(1);
    expect(fcs[0].foldChange).toBeCloseTo(2, 10);
    expect(fcs[0].percentChange).toBeCloseTo(100, 10);
    expect(fcs[0].log2FoldChange).toBeCloseTo(1, 10);
  });
});

describe("formatting", () => {
  it("respects sig figs and scientific notation", () => {
    const val = 12345.6789;
    expect(formatNumber(val, { ...defaultFormat, sigFigs: 3, scientificNotation: false })).toBe("1.23e+4");
    expect(formatNumber(val, { ...defaultFormat, sigFigs: 4, scientificNotation: false })).toBe("1.235e+4");
  });

  it("respects decimal override and padding", () => {
    const val = 12.3;
    expect(formatNumber(val, { ...defaultFormat, decimalPlaces: 2, padTrailingZeros: true })).toBe("12.30");
    expect(formatNumber(val, { ...defaultFormat, decimalPlaces: 0 })).toBe("12");
  });

  it("applies thousands separator", () => {
    const val = 12345.67;
    const out = formatNumber(val, { ...defaultFormat, decimalPlaces: 2, thousandsSeparator: true, scientificNotation: false });
    expect(out).toBe("12,345.67");
  });
});
