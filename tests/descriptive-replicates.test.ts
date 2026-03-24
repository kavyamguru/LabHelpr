import { describe, it, expect } from "vitest";
import { applyReplicateHandling } from "../lib/stats/descriptive/replicates";
import { NormalizedRow, ReplicateMode } from "../lib/stats/descriptive/types";

function row(partial: Partial<NormalizedRow>): NormalizedRow {
  return {
    sampleId: null,
    response: null,
    group: null,
    condition: null,
    dose: null,
    timepoint: null,
    bioRep: null,
    techRep: null,
    batch: null,
    plate: null,
    well: null,
    cellLine: null,
    genotype: null,
    units: null,
    controlFlag: null,
    rawRowIndex: 0,
    isMissingResponse: false,
    additional: {},
    ...partial,
  };
}

describe("replicate handling", () => {
  it("handles nested bio+tech with collapse", () => {
    const rows: NormalizedRow[] = [
      row({ rawRowIndex: 0, group: "A", bioRep: "B1", techRep: "T1", response: 1 }),
      row({ rawRowIndex: 1, group: "A", bioRep: "B1", techRep: "T2", response: 3 }),
      row({ rawRowIndex: 2, group: "A", bioRep: "B2", techRep: "T1", response: 4 }),
      row({ rawRowIndex: 3, group: "A", bioRep: "B2", techRep: "T2", response: 6 }),
    ];
    const res = applyReplicateHandling(rows, "nested" satisfies ReplicateMode, true);
    expect(res.analysisRows.length).toBe(2); // collapsed to biological means
    const responses = res.analysisRows.map((r) => r.response);
    expect(responses).toContain(2); // mean of 1 and 3
    expect(responses).toContain(5); // mean of 4 and 6
    expect(res.bioRepCount).toBe(2);
    expect(res.techRepCount).toBe(4);
    expect(res.warnings.length).toBe(0);
  });

  it("handles biological-only mode", () => {
    const rows: NormalizedRow[] = [
      row({ rawRowIndex: 0, group: "A", bioRep: "B1", response: 1 }),
      row({ rawRowIndex: 1, group: "A", bioRep: "B1", response: 3 }),
      row({ rawRowIndex: 2, group: "A", bioRep: "B2", response: 5 }),
    ];
    const res = applyReplicateHandling(rows, "biological" satisfies ReplicateMode, true);
    expect(res.analysisRows.length).toBe(2); // aggregated by bioRep
    const responses = res.analysisRows.map((r) => r.response);
    expect(responses).toContain(2); // mean of B1
    expect(responses).toContain(5); // B2 value
    expect(res.bioRepCount).toBe(2);
  });

  it("warns on technical-only without bio IDs", () => {
    const rows: NormalizedRow[] = [
      row({ rawRowIndex: 0, group: "A", techRep: "T1", response: 1 }),
      row({ rawRowIndex: 1, group: "A", techRep: "T2", response: 2 }),
    ];
    const res = applyReplicateHandling(rows, "technical" satisfies ReplicateMode, false);
    expect(res.analysisRows.length).toBe(2); // no collapse in technical mode
    expect(res.bioRepCount).toBe(rows.length); // defaults to rows when no bioRep
    expect(res.techRepCount).toBe(2);
    expect(res.warnings.some((w) => w.toLowerCase().includes("technical-only"))).toBe(true);
    expect(res.warnings.some((w) => w.toLowerCase().includes("no biological replicate"))).toBe(true);
  });
});
