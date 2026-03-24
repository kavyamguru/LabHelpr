import { AnalysisRow, NormalizedRow, ReplicateMode } from "./types";

interface ReplicateResult {
  analysisRows: AnalysisRow[];
  bioRepCount: number;
  techRepCount: number;
  warnings: string[];
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function groupKey(parts: (string | null | undefined)[]) {
  return parts.map((p) => (p ?? ""));
}

export function applyReplicateHandling(
  rows: NormalizedRow[],
  mode: ReplicateMode,
  collapseTechnical: boolean
): ReplicateResult {
  const warnings: string[] = [];
  const bioReps = new Set<string>();
  const techReps = new Set<string>();

  rows.forEach((r) => {
    if (r.bioRep) bioReps.add(r.bioRep);
    if (r.techRep) techReps.add(`${r.group || ""}::${r.bioRep || ""}::${r.techRep}`);
  });

  let analysisRows: AnalysisRow[] = [];

  if (mode === "nested") {
    if (!collapseTechnical) {
      warnings.push("Nested replicates with technical rows uncollapsed: technical replicates are not biological n.");
      analysisRows = rows.map((r) => ({ ...r, sourceRows: [r.rawRowIndex] }));
    } else {
      // collapse tech within each bioRep (and group)
      const byBio = new Map<string, AnalysisRow>();
      rows.forEach((r) => {
        const key = groupKey([r.group, r.bioRep]).join("||");
        const existing = byBio.get(key);
        const responseValues = existing?.additional?.responseValues as number[] | undefined;
        const values = responseValues ? [...responseValues] : [];
        if (r.response !== null) values.push(r.response);
        const next: AnalysisRow = {
          ...r,
          response: null,
          sourceRows: existing?.sourceRows ? [...existing.sourceRows, r.rawRowIndex] : [r.rawRowIndex],
          additional: { ...r.additional, responseValues: values },
        };
        byBio.set(key, next);
      });
      analysisRows = Array.from(byBio.values()).map((r) => {
        const values = (r.additional?.responseValues as number[]) || [];
        return { ...r, response: mean(values) };
      });
    }
  } else if (mode === "biological") {
    const byBio = new Map<string, AnalysisRow>();
    rows.forEach((r) => {
      const key = groupKey([r.group, r.bioRep || String(r.rawRowIndex)]).join("||");
      const existing = byBio.get(key);
      const responseValues = existing?.additional?.responseValues as number[] | undefined;
      const values = responseValues ? [...responseValues] : [];
      if (r.response !== null) values.push(r.response);
      const next: AnalysisRow = {
        ...r,
        response: null,
        sourceRows: existing?.sourceRows ? [...existing.sourceRows, r.rawRowIndex] : [r.rawRowIndex],
        additional: { ...r.additional, responseValues: values },
      };
      byBio.set(key, next);
    });
    analysisRows = Array.from(byBio.values()).map((r) => {
      const values = (r.additional?.responseValues as number[]) || [];
      return { ...r, response: mean(values) };
    });
  } else if (mode === "technical") {
    if (!bioReps.size) {
      warnings.push("Technical-only mode without biological IDs: interpretations will be limited.");
    }
    analysisRows = rows.map((r) => ({ ...r, sourceRows: [r.rawRowIndex] }));
  } else {
    // none
    analysisRows = rows.map((r) => ({ ...r, sourceRows: [r.rawRowIndex] }));
  }

  if (!bioReps.size) {
    warnings.push("No biological replicate column mapped; biological n may be misrepresented.");
  }
  if (!techReps.size && (mode === "nested" || mode === "technical")) {
    warnings.push("No technical replicate column mapped.");
  }

  return {
    analysisRows,
    bioRepCount: bioReps.size || rows.length,
    techRepCount: techReps.size,
    warnings,
  };
}
