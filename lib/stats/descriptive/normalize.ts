import { ColumnGuesses, DataRow, DEFAULT_MISSING_TOKENS } from "../../data/ingestion";
import { NormalizedRow } from "./types";

const missingSet = new Set(DEFAULT_MISSING_TOKENS.map((t) => t.toLowerCase()));

function toNullIfMissing(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string" && missingSet.has(val.trim().toLowerCase())) return null;
  if (typeof val === "number" && Number.isNaN(val)) return null;
  return String(val);
}

function toNumeric(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

export function normalizeRows(rows: DataRow[], mapping: ColumnGuesses, missingTokens: string[] = DEFAULT_MISSING_TOKENS) {
  const warnings: string[] = [];
  const missingLower = new Set(missingTokens.map((t) => t.toLowerCase()));

  const normalized: NormalizedRow[] = rows.map((row, idx) => {
    const getValue = (key?: string) => (key ? row[key] : undefined);

    const responseRaw = getValue(mapping.response);
    const responseNum = toNumeric(responseRaw);
    const isMissingResponse = responseNum === null || (typeof responseRaw === "string" && missingLower.has(responseRaw.trim().toLowerCase()));

    if (responseRaw !== undefined && responseNum === null && !isMissingResponse) {
      warnings.push(`Row ${idx + 1}: response could not be parsed as numeric.`);
    }

    const bioRep = toNullIfMissing(getValue(mapping.bioRep));
    const techRep = toNullIfMissing(getValue(mapping.techRep));

    const doseRaw = getValue(mapping.dose);
    const timeRaw = getValue(mapping.time);

    const dose = typeof doseRaw === "number" ? doseRaw : typeof doseRaw === "string" && doseRaw.trim() !== "" ? doseRaw : null;
    const timepoint = typeof timeRaw === "number" ? timeRaw : typeof timeRaw === "string" && timeRaw.trim() !== "" ? timeRaw : null;

    return {
      sampleId: toNullIfMissing(getValue(mapping.sampleId)),
      response: responseNum,
      group: toNullIfMissing(getValue(mapping.group)),
      condition: toNullIfMissing(getValue(mapping.group)),
      dose,
      timepoint,
      bioRep,
      techRep,
      batch: toNullIfMissing(getValue(mapping.batch)),
      plate: toNullIfMissing(getValue(mapping.plate)),
      well: toNullIfMissing(getValue(mapping.well)),
      cellLine: toNullIfMissing(getValue(mapping.cellLine)),
      genotype: toNullIfMissing(getValue(mapping.genotype)),
      units: toNullIfMissing(getValue(mapping.units)),
      controlFlag: toNullIfMissing(getValue(mapping.controlFlag)),
      rawRowIndex: idx,
      isMissingResponse,
      additional: {},
    };
  });

  return { normalized, warnings };
}
