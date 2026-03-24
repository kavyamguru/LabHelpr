import Papa from "papaparse";
import * as XLSX from "xlsx";

export type DataRow = Record<string, unknown>;

export type StructureKind =
  | "tidy"
  | "plate-wide"
  | "well-columns"
  | "unknown";

export type IngestionSourceType = "pasted" | "csv" | "tsv" | "excel" | "unknown";

export interface ParsedTable {
  headers: string[];
  rows: DataRow[];
  notes: string[];
  structure: StructureKind;
}

export interface ColumnGuesses {
  response?: string;
  group?: string;
  dose?: string;
  time?: string;
  bioRep?: string;
  techRep?: string;
  batch?: string;
  plate?: string;
  well?: string;
  sampleId?: string;
  cellLine?: string;
  genotype?: string;
  controlFlag?: string;
  units?: string;
}

export interface IngestionAudit {
  sourceType: IngestionSourceType;
  originalColumns: string[];
  inferredStructure: StructureKind;
  missingTokens: string[];
  notes: string[];
}

export interface NormalizedDataset {
  raw: ParsedTable;
  normalized: ParsedTable;
  mappingGuesses: ColumnGuesses;
  audit: IngestionAudit;
  missingTokens: string[];
}

export const DEFAULT_MISSING_TOKENS = ["", "na", "n/a", "null", "nan", "missing", "none", "-", "--"];
const MISSING_TOKEN_SET = new Set(DEFAULT_MISSING_TOKENS);

export function isMissing(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "number") return Number.isNaN(val);
  if (typeof val === "string") return MISSING_TOKEN_SET.has(val.trim().toLowerCase());
  return false;
}

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function findHeader(headers: string[], keywords: string[]): string | undefined {
  // deterministic: exact normalized match first, then substring match, preserving header order
  const normalized = headers.map(normalizeHeader);
  for (const keyword of keywords) {
    const exactIdx = normalized.findIndex((h) => h === keyword);
    if (exactIdx >= 0) return headers[exactIdx];
  }
  for (const keyword of keywords) {
    const matchIdx = normalized.findIndex((h) => h.includes(keyword));
    if (matchIdx >= 0) return headers[matchIdx];
  }
  return undefined;
}

export function inferColumnRoles(headers: string[]): ColumnGuesses {
  return {
    response: findHeader(headers, ["response", "value", "measurement", "readout", "intensity", "od", "ct", "absorbance", "signal", "density", "fluor", "lum"]),
    group: findHeader(headers, ["condition", "group", "treatment", "arm", "cohort", "control", "treated"]),
    dose: findHeader(headers, ["dose", "conc", "concentration", "molar", "um", "nm", "mg_ml", "ug_ml", "micromolar", "nanomolar"]),
    time: findHeader(headers, ["time", "timepoint", "hour", "hr", "day", "min"]),
    bioRep: findHeader(headers, ["bio", "biol", "donor", "animal", "subject", "patient", "clone"]),
    techRep: findHeader(headers, ["tech", "technical", "well", "replicate", "measurement", "repeat"]),
    batch: findHeader(headers, ["batch", "run", "date", "experiment_date"]),
    plate: findHeader(headers, ["plate", "plate_id", "plate_name"]),
    well: findHeader(headers, ["well", "well_id", "row_col"]),
    sampleId: findHeader(headers, ["sample", "sample_id", "id", "specimen"]),
    cellLine: findHeader(headers, ["cell_line", "cellline", "line", "cells"]),
    genotype: findHeader(headers, ["genotype", "strain", "variant"]),
    controlFlag: findHeader(headers, ["control", "ctrl", "vehicle"]),
    units: findHeader(headers, ["unit", "units"]),
  };
}

export function mergeColumnMappings(base: ColumnGuesses, overrides: ColumnGuesses): ColumnGuesses {
  // overrides wins when provided (non-empty string)
  const cleanOverrides: ColumnGuesses = {};
  Object.entries(overrides).forEach(([k, v]) => {
    if (typeof v === "string" && v.trim() !== "") {
      (cleanOverrides as any)[k] = v;
    }
  });
  return { ...base, ...cleanOverrides };
}

export function parseDelimited(text: string): ParsedTable {
  const parsed = Papa.parse<DataRow>(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
  const headers = parsed.meta.fields || [];
  const rows = parsed.data || [];
  return { headers, rows, notes: [], structure: "unknown" };
}

const MAX_XLSX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_XLSX_ROWS = 20000;
const MAX_XLSX_COLS = 200;

function sanitizeHeaders(headers: string[]): string[] {
  const seen = new Set<string>();
  return headers.map((h, idx) => {
    let cleaned = String(h ?? "").trim();
    if (!cleaned) cleaned = `column_${idx + 1}`;
    cleaned = cleaned.replace(/[^A-Za-z0-9_\-]+/g, "");
    if (!cleaned) cleaned = `column_${idx + 1}`;
    let unique = cleaned;
    let counter = 1;
    while (seen.has(unique.toLowerCase())) {
      unique = `${cleaned}_${counter++}`;
    }
    seen.add(unique.toLowerCase());
    return unique;
  });
}

function sanitizeRowValues(row: DataRow, notes: string[]): DataRow {
  const out: DataRow = {};
  Object.entries(row).forEach(([k, v]) => {
    if (typeof v === "string" && v.trim().startsWith("=")) {
      notes.push(`Formula-like content neutralized in column ${k}`);
      out[k] = "";
    } else if (typeof v === "object" && v !== null) {
      out[k] = String(v);
    } else {
      out[k] = v;
    }
  });
  return out;
}

export function parseExcel(buffer: ArrayBuffer, opts?: { maxBytes?: number; maxRows?: number; maxCols?: number }): ParsedTable {
  const maxBytes = opts?.maxBytes ?? MAX_XLSX_BYTES;
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Excel file too large (>${Math.round(maxBytes / (1024 * 1024))}MB). Use CSV or a smaller sheet.`);
  }
  const workbook = XLSX.read(buffer, { type: "array", sheetStubs: false, cellNF: false, cellStyles: false, cellFormula: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("No sheets found in Excel file.");
  const worksheet = workbook.Sheets[firstSheet];
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  const colCount = range.e.c - range.s.c + 1;
  if (colCount > (opts?.maxCols ?? MAX_XLSX_COLS)) {
    throw new Error(`Excel sheet has too many columns (> ${opts?.maxCols ?? MAX_XLSX_COLS}). Trim columns or use CSV.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: "", raw: true, range: 0 });
  if (rawRows.length > (opts?.maxRows ?? MAX_XLSX_ROWS)) {
    throw new Error(`Excel sheet too large (> ${opts?.maxRows ?? MAX_XLSX_ROWS} rows). Use CSV or trim the sheet.`);
  }
  const headerKeys = rawRows.length ? Object.keys(rawRows[0]) : [];
  const maxCols = opts?.maxCols ?? MAX_XLSX_COLS;
  if (headerKeys.length > maxCols) {
    throw new Error(`Excel sheet has too many columns (> ${maxCols}). Trim columns or use CSV.`);
  }
  const sanitizedHeaders = sanitizeHeaders(headerKeys);
  const notes: string[] = [];
  const rows = rawRows.map((r) => sanitizeRowValues(r, notes));
  const remappedRows = rows.map((r) => {
    const out: DataRow = {};
    sanitizedHeaders.forEach((h, idx) => {
      const original = headerKeys[idx];
      out[h] = r[original];
    });
    return out;
  });
  return { headers: sanitizedHeaders, rows: remappedRows, notes, structure: "unknown" };
}

export function looksLikePlateWide(headers: string[], rows: DataRow[]): boolean {
  const normalized = headers.map(normalizeHeader);
  const hasRowHeader = normalized.includes("row") || normalized.includes("rows");
  const numericColumns = headers.filter((h) => /^\d+$/.test(h.trim())) || [];
  return hasRowHeader && numericColumns.length >= 3 && rows.length > 0;
}

export function looksLikeWellColumns(headers: string[]): boolean {
  const wellPattern = /^[A-Ha-h](?:[1-9]|1[0-2])$/;
  const wellColumns = headers.filter((h) => wellPattern.test(h.trim()));
  return wellColumns.length >= 6;
}

export function tidyPlateWide(headers: string[], rows: DataRow[]): ParsedTable {
  const normalized = headers.map(normalizeHeader);
  const rowKeyIndex = normalized.indexOf("row");
  if (rowKeyIndex === -1) return { headers, rows, notes: ["Could not find Row header"], structure: "plate-wide" };

  const numericColumns = headers.filter((h) => /^\d+$/.test(h.trim()));
  const tidy: DataRow[] = [];

  rows.forEach((r) => {
    const rowValues = Object.values(r);
    const rowLabel = String(rowValues[rowKeyIndex] ?? "").trim();
    numericColumns.forEach((h) => {
      const value = (r as DataRow)[h];
      const well = `${rowLabel}${h}`;
      tidy.push({ Well: well, Value: value, Row: rowLabel, Column: h });
    });
  });

  return { headers: ["Well", "Value", "Row", "Column"], rows: tidy, notes: ["Detected plate-shaped wide data; converted to tidy long-form."], structure: "plate-wide" };
}

export function tidyWellColumns(headers: string[], rows: DataRow[]): ParsedTable {
  const wellPattern = /^[A-Ha-h](?:[1-9]|1[0-2])$/;
  const wellColumns = headers.filter((h) => wellPattern.test(h.trim()));
  const tidy: DataRow[] = [];
  rows.forEach((r) => {
    wellColumns.forEach((h) => {
      tidy.push({ Well: h, Value: r[h] });
    });
  });
  return { headers: ["Well", "Value"], rows: tidy, notes: ["Detected well-named columns; converted to tidy long-form."], structure: "well-columns" };
}

export function tidyFallback(headers: string[], rows: DataRow[]): ParsedTable {
  return { headers, rows, notes: ["Data loaded; no plate reshape applied (already tidy or non-plate)."], structure: "tidy" };
}

export function previewRows(rows: DataRow[], limit = 12): DataRow[] {
  return rows.slice(0, limit);
}

export function summarizeMissing(rows: DataRow[], headers: string[]) {
  const counts: Record<string, number> = {};
  headers.forEach((h) => (counts[h] = 0));
  rows.forEach((r) => {
    headers.forEach((h) => {
      if (isMissing(r[h])) counts[h] += 1;
    });
  });
  return counts;
}

function reshapeToNormalized(headers: string[], rows: DataRow[]): ParsedTable {
  if (looksLikePlateWide(headers, rows)) return tidyPlateWide(headers, rows);
  if (looksLikeWellColumns(headers)) return tidyWellColumns(headers, rows);
  return tidyFallback(headers, rows);
}

function buildAudit(sourceType: IngestionSourceType, rawHeaders: string[], normalized: ParsedTable): IngestionAudit {
  return {
    sourceType,
    originalColumns: rawHeaders,
    inferredStructure: normalized.structure,
    missingTokens: DEFAULT_MISSING_TOKENS,
    notes: normalized.notes,
  };
}

export function ingestDelimited(text: string, sourceType: IngestionSourceType = "pasted"): NormalizedDataset {
  const raw = parseDelimited(text);
  const normalized = reshapeToNormalized(raw.headers, raw.rows);
  const mappingGuesses = inferColumnRoles(normalized.headers.length ? normalized.headers : raw.headers);
  const audit = buildAudit(sourceType, raw.headers, normalized);
  return { raw, normalized, mappingGuesses, audit, missingTokens: DEFAULT_MISSING_TOKENS };
}

export function ingestExcel(buffer: ArrayBuffer, sourceType: IngestionSourceType = "excel"): NormalizedDataset {
  const raw = parseExcel(buffer);
  const normalized = reshapeToNormalized(raw.headers, raw.rows);
  const mappingGuesses = inferColumnRoles(normalized.headers.length ? normalized.headers : raw.headers);
  const audit = buildAudit(sourceType, raw.headers, normalized);
  return { raw, normalized, mappingGuesses, audit, missingTokens: DEFAULT_MISSING_TOKENS };
}
