"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/\s+/g, "_");
}

function inferColumns(headers: string[]) {
  const lower = headers.map((h) => normalizeHeader(h));
  const findMatch = (keywords: string[]) =>
    headers.find((h, idx) => keywords.some((k) => lower[idx].includes(k)));

  return {
    treatment: findMatch(["treatment", "condition", "drug", "agent"]),
    concentration: findMatch(["conc", "dose", "concentration", "molar", "ug_ml", "mg_ml"]),
    bioReplicate: findMatch(["biological", "bio_rep", "donor", "animal", "subject"]),
    techReplicate: findMatch(["technical", "tech_rep", "well", "replicate", "measurement"]),
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
    numericColumns.forEach(({ h, idx }) => {
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

export default function DataUploaderPage() {
  const [rawRows, setRawRows] = useState<any[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [tidyRows, setTidyRows] = useState<any[] | null>(null);
  const [mapping, setMapping] = useState<{
    treatment?: string;
    concentration?: string;
    bioReplicate?: string;
    techReplicate?: string;
  }>({});
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const availableColumns = useMemo(() => headers, [headers]);

  function handleMappingChange(key: "treatment" | "concentration" | "bioReplicate" | "techReplicate", value: string) {
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

  function loadSample() {
    const result = Papa.parse(samplePlateCsv, { header: true, skipEmptyLines: true });
    const rows = result.data as any[];
    const headerList = rows.length ? Object.keys(rows[0]) : [];
    setHeaders(headerList);
    const guesses = inferColumns(headerList);
    setMapping(guesses);
    const tidy = tidyPlateWide(headerList, rows);
    setRawRows(rows);
    setTidyRows(tidy);
    setStatus("Loaded sample 96-well plate data and converted to tidy form.");
    setError("");
  }

  const tidyPreview = useMemo(() => formatPreview(tidyRows || []), [tidyRows]);
  const rawPreview = useMemo(() => formatPreview(rawRows || []), [rawRows]);

  return (
    <main className="calc-page" style={{ maxWidth: 1180 }}>
      <header className="calc-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="badge" style={{ marginBottom: 8 }}>Standalone • Data Uploader & Tidy Engine</div>
            <h1 style={{ margin: 0 }}>Data Uploader & Tidy Engine</h1>
            <p style={{ marginTop: 6, maxWidth: 820 }}>
              Upload CSV, Excel, or plate map data. We&apos;ll tidy it to long-form, detect key experimental columns, and prepare it for downstream analysis.
            </p>
          </div>
          <button className="btn-primary" onClick={loadSample} aria-label="Load sample plate data">
            Load sample plate
          </button>
        </div>
      </header>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>1) Upload data</div>
            <p style={{ marginTop: 0 }}>Accepts .csv, .xls, .xlsx. Plate-shaped files are automatically reshaped using wellmap-style logic.</p>
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
              </div>
            </div>
          ) : null}
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

      <section className="calc-card">
        <div style={{ fontWeight: 800, marginBottom: 6 }}>What happens under the hood</div>
        <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Accepts CSV, Excel, or plate map data.</li>
          <li>Automatically detects plate-shaped wide data (Row + 1–12) and converts to tidy long-form (Well, Value, Row, Column).</li>
          <li>Detects well-named columns (A1–H12) and melts them to tidy form.</li>
          <li>Guesses key experimental columns: Treatment, Concentration, Biological Replicate, Technical Replicate (editable in-place).</li>
          <li>Provides instant raw vs tidy previews (first few rows) for validation.</li>
        </ul>
      </section>
    </main>
  );
}
