"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ELISA_SAMPLE, PLATE_SAMPLE } from "./sampleData";
import {
  ColumnGuesses,
  IngestionSourceType,
  ParsedTable,
  StructureKind,
  ingestDelimited,
  ingestExcel,
  mergeColumnMappings,
  previewRows,
  summarizeMissing,
} from "../../lib/data/ingestion";
import { computeDescriptiveStats } from "../../lib/stats/descriptive";
import { DescriptiveResult, ReplicateMode } from "../../lib/stats/descriptive/types";
import { buildHistogramData, buildHistogramFacets, buildBoxData, buildViolinData, buildStripData, buildQQData, buildBioTechData } from "../../lib/stats/descriptive/chartData";
import { HistogramPlot, StripPlot, QQPlot } from "./components/plots/SimplePlots";
import { BoxPlot, ViolinPlot } from "./components/plots/SummaryPlots";
import { BioTechPlot } from "./components/plots/BioTechPlot";
import { PlotExportButton } from "./components/PlotExportButton";
import { InterpretationPanel } from "./components/InterpretationPanel";
import { metricLabels } from "../../lib/stats/descriptive/metricConfig";
import { MetricTooltip } from "./components/MetricTooltip";
import { ExportsPanel } from "./components/ExportsPanel";
import { AnalysisAudit } from "./components/AnalysisAudit";
import { buildExportPayload } from "../../lib/stats/descriptive/buildExportPayload";

const mappingOrder: Array<{ key: keyof ColumnGuesses; label: string; helper?: string }> = [
  { key: "response", label: "Response / measurement", helper: "Numeric outcome column" },
  { key: "group", label: "Condition / treatment" },
  { key: "dose", label: "Concentration / dose" },
  { key: "time", label: "Timepoint" },
  { key: "bioRep", label: "Biological replicate ID" },
  { key: "techRep", label: "Technical replicate ID" },
  { key: "batch", label: "Batch / experiment date" },
  { key: "plate", label: "Plate ID" },
  { key: "well", label: "Well ID" },
  { key: "sampleId", label: "Sample ID" },
  { key: "cellLine", label: "Cell line" },
  { key: "genotype", label: "Genotype" },
  { key: "controlFlag", label: "Control flag" },
  { key: "units", label: "Units" },
];

function MappingSelect({
  label,
  helper,
  value,
  options,
  onChange,
}: {
  label: string;
  helper?: string;
  value?: string;
  options: string[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="label" style={{ display: "block" }}>
      <div style={{ fontWeight: 700 }}>{label}</div>
      {helper && <div className="helper" style={{ fontSize: 12 }}>{helper}</div>}
      <select
        className="input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        style={{ width: "100%", marginTop: 4 }}
      >
        <option value="">Not mapped</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

const infoBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#f8fafc",
};

type AnalysisAudit = {
  sourceType: IngestionSourceType;
  originalColumns: string[];
  inferredStructure: StructureKind;
  userMappings: ColumnGuesses;
  replicateMode: ReplicateMode;
  collapseTechnical: boolean;
  missingTokens: string[];
  notes: string[];
  unitColumn?: string;
};

export default function DescriptiveStatsPhase1() {
  const [rawText, setRawText] = useState(ELISA_SAMPLE);
  const [rawTable, setRawTable] = useState<ParsedTable | null>(null);
  const [normalized, setNormalized] = useState<ParsedTable | null>(null);
  const [analysisRows, setAnalysisRows] = useState<ParsedTable | null>(null); // placeholder for downstream transforms
  const [notes, setNotes] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnGuesses>({});
  const [replicateMode, setReplicateMode] = useState<ReplicateMode>("nested");
  const [collapseTechnical, setCollapseTechnical] = useState<boolean>(true);
  const [audit, setAudit] = useState<AnalysisAudit>({
    sourceType: "pasted",
    originalColumns: [],
    inferredStructure: "unknown",
    userMappings: {},
    replicateMode: "nested",
    collapseTechnical: true,
    missingTokens: [],
    notes: [],
    unitColumn: undefined,
  });
  const [descriptive, setDescriptive] = useState<DescriptiveResult | null>(null);
  const [controlGroup, setControlGroup] = useState<string | undefined>(undefined);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [facetHist, setFacetHist] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<string>("Loaded ELISA sample");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    handleParseText(rawText, "Sample: ELISA", "pasted");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateAuditUserMapping(nextMapping: ColumnGuesses) {
    setAudit((prev) => ({
      ...prev,
      userMappings: nextMapping,
      unitColumn: nextMapping.units,
      replicateMode,
      collapseTechnical,
    }));
  }

  function handleParseText(text: string, origin: string, source: IngestionSourceType = "pasted") {
    try {
      setError("");
      const result = ingestDelimited(text, source);
      setRawTable(result.raw);
      setNormalized(result.normalized);
      setAnalysisRows(result.normalized); // placeholder: later transforms feed analysis rows
      const merged = mergeColumnMappings(result.mappingGuesses, mapping);
      setMapping(merged);
      setNotes(result.normalized.notes || []);
      setAudit({
        sourceType: source,
        originalColumns: result.audit.originalColumns,
        inferredStructure: result.audit.inferredStructure,
        missingTokens: result.audit.missingTokens,
        notes: result.audit.notes,
        userMappings: merged,
        replicateMode,
        collapseTechnical,
        unitColumn: merged.units,
      });
      setStatus(`Parsed ${result.raw.rows.length} rows from ${origin || "pasted data"}`);
      setDescriptive(null);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to parse";
      setError(message);
      setStatus("");
    }
  }

  async function handleFile(file: File) {
    setError("");
    setStatus("Parsing file...");
    try {
      if (file.name.endsWith(".csv") || file.type === "text/csv" || file.type === "text/tab-separated-values") {
        const text = await file.text();
        handleParseText(text, file.name, "csv");
      } else if (file.name.endsWith(".xls") || file.name.endsWith(".xlsx")) {
        const buffer = await file.arrayBuffer();
        const result = ingestExcel(buffer, "excel");
        setRawTable(result.raw);
        setNormalized(result.normalized);
        setAnalysisRows(result.normalized);
        const merged = mergeColumnMappings(result.mappingGuesses, mapping);
        setMapping(merged);
        setNotes(result.normalized.notes || []);
        setAudit({
          sourceType: "excel",
          originalColumns: result.audit.originalColumns,
          inferredStructure: result.audit.inferredStructure,
          missingTokens: result.audit.missingTokens,
          notes: result.audit.notes,
          userMappings: merged,
          replicateMode,
          collapseTechnical,
          unitColumn: merged.units,
        });
        setDescriptive(null);
        setStatus(`Parsed ${result.raw.rows.length} rows from ${file.name}`);
      } else {
        throw new Error("Unsupported file type. Use CSV or Excel.");
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to parse file";
      setError(message);
      setStatus("");
    }
  }

  const headers = normalized?.headers || rawTable?.headers || [];
  const preview = useMemo(() => (normalized ? previewRows(normalized.rows) : []), [normalized]);
  const missingSummary = useMemo(() => (normalized ? summarizeMissing(normalized.rows, headers) : {}), [normalized, headers]);

  const groupCounts = useMemo(() => {
    if (!normalized || !mapping.group) return { groups: 0, labels: [] as string[] };
    const labels = Array.from(new Set(normalized.rows.map((r) => String(r[mapping.group as string] ?? "").trim()).filter(Boolean)));
    return { groups: labels.length, labels };
  }, [normalized, mapping.group]);

  const bioTechCounts = useMemo(() => {
    if (!normalized) return { nBio: 0, nTech: 0, avgTechPerBio: 0 };
    const bioKey = mapping.bioRep;
    const techKey = mapping.techRep;
    const bioSet = new Set<string>();
    let techCount = 0;
    normalized.rows.forEach((r, idx) => {
      if (bioKey) {
        const bio = String(r[bioKey] ?? "").trim();
        if (bio) bioSet.add(bio);
      }
      if (techKey && r[techKey] !== undefined && r[techKey] !== "") techCount += 1;
      if (!bioKey) bioSet.add(`row-${idx}`);
    });
    const nBio = bioSet.size;
    return { nBio, nTech: techCount, avgTechPerBio: nBio ? techCount / nBio : 0 };
  }, [normalized, mapping.bioRep, mapping.techRep]);

  const rowCounts = useMemo(
    () => ({
      raw: rawTable?.rows.length ?? 0,
      normalized: normalized?.rows.length ?? 0,
      analysis: analysisRows?.rows.length ?? 0,
    }),
    [rawTable, normalized, analysisRows]
  );

  useEffect(() => {
    if (!mapping) return;
    updateAuditUserMapping(mapping);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping, replicateMode, collapseTechnical]);

  useEffect(() => {
    if (!normalized) return;
    try {
      const { result, warnings: computeWarnings } = computeDescriptiveStats(normalized.rows, {
        replicateMode,
        collapseTechnical,
        mapping,
        missingTokens: audit.missingTokens.length ? audit.missingTokens : [],
        audit: {
          sourceType: audit.sourceType,
          inferredStructure: audit.inferredStructure,
          notes: audit.notes,
        },
        controlGroup,
      });
      setDescriptive(result);
      setWarnings(computeWarnings);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to compute stats");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, mapping, replicateMode, collapseTechnical, controlGroup]);

  const histogramData = useMemo(() => (descriptive ? buildHistogramData(descriptive.analysisRows) : null), [descriptive]);
  const histogramFacets = useMemo(() => (descriptive ? buildHistogramFacets(descriptive.analysisRows) : {}), [descriptive]);
  const boxData = useMemo(() => (descriptive ? buildBoxData(descriptive.analysisRows) : null), [descriptive]);
  const violinData = useMemo(() => (descriptive ? buildViolinData(descriptive.analysisRows) : null), [descriptive]);
  const stripData = useMemo(() => (descriptive ? buildStripData(descriptive.analysisRows) : null), [descriptive]);
  const qqData = useMemo(() => (descriptive ? buildQQData(descriptive.analysisRows) : null), [descriptive]);
  const bioTechData = useMemo(() => (descriptive ? buildBioTechData(descriptive.analysisRows, descriptive.audit.replicateMode, descriptive.audit.collapseTechnical) : null), [descriptive]);

  const histRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const violinRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const qqRef = useRef<HTMLDivElement>(null);
  const bioTechRef = useRef<HTMLDivElement>(null);
  const exportPayload = useMemo(() => (descriptive ? buildExportPayload(descriptive, { controlGroup, units: descriptive.audit.mapping.units ?? null }) : null), [descriptive, controlGroup]);

  return (
    <main className="calc-page" style={{ maxWidth: 1180 }}>
      <header className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="badge" style={{ marginBottom: 8 }}>Phase 1 · Ingestion & Mapping</div>
            <h1 style={{ margin: 0 }}>Descriptive Statistics (Wet-lab, replicate-aware)</h1>
            <p style={{ marginTop: 6, maxWidth: 900 }}>
              Upload or paste experimental data, confirm column mapping, and declare replicate structure. This is descriptive-only and prioritizes biological replicates as the reporting unit.
            </p>
          </div>
          <div className="pill" style={{ background: "#eef2ff", color: "#4338ca", fontWeight: 700 }}>Biologist-first · Descriptive only</div>
        </div>
      </header>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div className="section-title">1) Upload / Import</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <label className="label" style={{ marginBottom: 6, fontWeight: 700 }}>Paste data (CSV, TSV, or comma/tab-separated)</label>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 160, fontFamily: "monospace" }}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste CSV or tabular data here"
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <button className="primary" type="button" onClick={() => handleParseText(rawText, "pasted data", "pasted")}>Parse pasted data</button>
              <label className="ghost-button" style={{ cursor: "pointer" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.xls,.xlsx,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                Upload CSV / Excel
              </label>
              <button className="ghost-button" type="button" onClick={() => { setRawText(ELISA_SAMPLE); handleParseText(ELISA_SAMPLE, "ELISA sample", "pasted"); }}>Load ELISA sample</button>
              <button className="ghost-button" type="button" onClick={() => { setRawText(PLATE_SAMPLE); handleParseText(PLATE_SAMPLE, "Plate sample", "pasted"); }}>Load plate sample</button>
            </div>
            {status && <div style={{ marginTop: 6, color: "#166534", fontWeight: 600 }}>{status}</div>}
            {error && <div style={{ marginTop: 6, color: "#b91c1c", fontWeight: 600 }}>{error}</div>}
          </div>
          <div style={infoBox}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Tips (wet-lab aware)</div>
            <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.5, fontSize: 13 }}>
              <li>Prefer CSV upload for reliability; Excel is supported with size/shape limits.</li>
              <li>Include biological replicate IDs; technical replicates should nest within them.</li>
              <li>Mark concentration/dose and timepoint columns if present.</li>
              <li>Plate data: include a Row header + numeric columns, or well-named columns (A1–H12).</li>
              <li>Missing values are never dropped silently; we surface counts per column.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div className="section-title">2) Raw data preview</div>
        {!normalized || preview.length === 0 ? (
          <div className="empty">No rows parsed yet. Paste or upload data to begin.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Preview (first {preview.length} rows)</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: 6, background: "#f8fafc" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} style={{ borderTop: "1px solid #e5e7eb" }}>
                        {headers.map((h) => (
                          <td key={h} style={{ padding: 6, background: missingSummary[h] && isMissingCell(row[h]) ? "#fff1f2" : "transparent" }}>
                            {String(row[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {normalized.rows.length > preview.length && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>Showing first {preview.length} of {normalized.rows.length} rows.</div>
              )}
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Row counts · raw: {rowCounts.raw} · normalized: {rowCounts.normalized} · analysis: {rowCounts.analysis}
              </div>
            </div>
            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Missingness (by column)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                {headers.map((h) => (
                  <div key={h} style={{ padding: 8, border: "1px solid #e5e7eb", borderRadius: 10, background: "#f9fafb" }}>
                    <div style={{ fontWeight: 700 }}>{h}</div>
                    <div style={{ fontSize: 13 }}>{missingSummary[h] ?? 0} missing</div>
                  </div>
                ))}
              </div>
              {notes.length > 0 && (
                <ul style={{ marginTop: 10, paddingLeft: 16, color: "#374151", fontSize: 13 }}>
                  {notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div className="section-title">3) Column mapping (auto-detected, editable)</div>
        {!headers.length ? (
          <div className="empty">No headers found. Upload or paste data with a header row.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {mappingOrder.map(({ key, label, helper }) => (
              <MappingSelect
                key={key}
                label={label}
                helper={helper}
                value={mapping[key]}
                options={headers}
                onChange={(v) => {
                  setMapping((m) => ({ ...m, [key]: v }));
                }}
              />
            ))}
          </div>
        )}
        {headers.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#374151" }}>
            Auto-detected guesses (deterministic): {Object.entries(mapping).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}
          </div>
        )}
      </section>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div className="section-title">4) Replicate setup</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div className="label" style={{ fontWeight: 700, marginBottom: 6 }}>Replicate structure</div>
            <div className="radio-group" style={{ display: "grid", gap: 6 }}>
              <label className="radio">
                <input type="radio" checked={replicateMode === "none"} onChange={() => setReplicateMode("none")} />
                No replicate structure specified
              </label>
              <label className="radio">
                <input type="radio" checked={replicateMode === "technical"} onChange={() => setReplicateMode("technical")} />
                Technical replicates only (n still counts biological replicates)
              </label>
              <label className="radio">
                <input type="radio" checked={replicateMode === "biological"} onChange={() => setReplicateMode("biological")} />
                Biological replicates only
              </label>
              <label className="radio">
                <input type="radio" checked={replicateMode === "nested"} onChange={() => setReplicateMode("nested")} />
                Technical nested within biological (recommended for wet-lab)
              </label>
            </div>
            {replicateMode === "nested" || replicateMode === "technical" ? (
              <label className="checkbox" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={collapseTechnical}
                  onChange={(e) => setCollapseTechnical(e.target.checked)}
                />
                Collapse technical replicates to biological mean for downstream summaries (recommended)
              </label>
            ) : null}
            <ul style={{ marginTop: 10, paddingLeft: 16, color: "#b45309", fontSize: 13 }}>
              <li>Technical replicates are never treated as biological n.</li>
              <li>SEM/CI will later use biological n only.</li>
              <li>Keep bio_rep and tech_rep columns populated to avoid miscounting.</li>
            </ul>
          </div>
          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Quick counts</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <Stat label="Biological replicates" value={bioTechCounts.nBio.toString()} />
              <Stat label="Technical replicates" value={bioTechCounts.nTech.toString()} />
              <Stat label="Avg technical per biological" value={bioTechCounts.avgTechPerBio.toFixed(2)} />
              <Stat label="Groups detected" value={groupCounts.groups.toString()} helper={groupCounts.labels.join(", ")} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              Counts are based on current mapping selections. Biological replicates default to unique rows if no bio_rep is mapped.
            </div>
          </div>
        </div>
      </section>

      {groupCounts.labels.length > 0 && (
        <section className="calc-card" style={{ marginBottom: 12 }}>
          <div className="section-title">Control group (optional)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="input"
              style={{ maxWidth: 320 }}
              value={controlGroup ?? ""}
              onChange={(e) => setControlGroup(e.target.value || undefined)}
            >
              <option value="">No control selected</option>
              {groupCounts.labels.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <div style={{ fontSize: 13, color: "#6b7280" }}>Feeds control comparisons and fold-change fields.</div>
          </div>
        </section>
      )}

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div className="section-title">5) Descriptive statistics</div>
        {!descriptive ? (
          <div className="empty">Parse data and confirm mappings to see descriptive summaries.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <Stat label="Total rows" value={descriptive.metrics.totalRows.toString()} />
              <Stat label="Usable responses" value={descriptive.metrics.usableResponseRows.toString()} />
              <Stat label="Missing responses" value={descriptive.metrics.missingResponse.toString()} />
              <Stat label="Groups" value={descriptive.metrics.groups.toString()} />
              <Stat label="Biological replicates" value={descriptive.metrics.bioRepCount.toString()} />
              <Stat label="Technical replicates" value={descriptive.metrics.techRepCount.toString()} />
            </div>

            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Overall summary</div>
              <SummaryTable groups={[descriptive.overall]} />
            </div>

            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Per-group summary</div>
              <SummaryTable groups={descriptive.byGroup} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Histogram</div>
                </div>
                {groupCounts.groups > 2 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", marginBottom: 6 }}>
                    <input type="checkbox" checked={facetHist} onChange={(e) => setFacetHist(e.target.checked)} /> Facet by group when overlays crowd
                  </label>
                )}
                {facetHist && groupCounts.groups > 2 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    {Object.entries(histogramFacets).map(([g, h]) => (
                      <div key={g} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{g}</div>
                        <HistogramPlot data={h as any} />
                      </div>
                    ))}
                  </div>
                ) : (
                  histogramData ? (
                    <div ref={histRef}>
                      <HistogramPlot data={histogramData} />
                      <div style={{ marginTop: 6 }}><PlotExportButton targetRef={histRef} label="Export PNG" filenameBase={`histogram-${Date.now()}`} /></div>
                    </div>
                  ) : <div style={{ fontSize: 13 }}>Not enough data.</div>
                )}
              </div>
              <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Box / spread</div>
                {boxData ? (
                  <div ref={boxRef}>
                    <BoxPlot data={boxData} />
                    <div style={{ marginTop: 6 }}><PlotExportButton targetRef={boxRef} label="Export PNG" filenameBase={`box-${Date.now()}`} /></div>
                  </div>
                ) : <div style={{ fontSize: 13 }}>Not enough data.</div>}
              </div>
              <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Violin</div>
                {(() => {
                  if (!violinData || !violinData.labels.length) return <div style={{ fontSize: 13 }}>Not enough data.</div>;
                  const counts = violinData.counts || {};
                  const smallGroups = Object.entries(counts).filter(([, c]) => c < 5).map(([g]) => g);
                  const cautionGroups = Object.entries(counts).filter(([, c]) => c >= 5 && c < 10).map(([g]) => g);
                  if (smallGroups.length) {
                    return <div style={{ fontSize: 13 }}>Violin hidden: groups with n&lt;5 ({smallGroups.join(", ")}). Use box/strip.</div>;
                  }
                  return (
                    <div style={{ display: "grid", gap: 6 }} ref={violinRef}>
                      <ViolinPlot data={violinData} />
                      {cautionGroups.length ? (
                        <div style={{ fontSize: 12, color: "#b45309" }}>
                          Caution: groups with n 5–9 ({cautionGroups.join(", ")}) — raw points shown in strip plot; violin shape is approximate.
                        </div>
                      ) : null}
                      <div><PlotExportButton targetRef={violinRef} label="Export PNG" filenameBase={`violin-${Date.now()}`} /></div>
                    </div>
                  );
                })()}
              </div>
              <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Strip / dot plot</div>
                {stripData ? (
                  <div ref={stripRef}>
                    <StripPlot data={stripData} />
                    <div style={{ marginTop: 6 }}><PlotExportButton targetRef={stripRef} label="Export PNG" filenameBase={`strip-${Date.now()}`} /></div>
                  </div>
                ) : <div style={{ fontSize: 13 }}>Not enough data.</div>}
              </div>
              <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>QQ plot</div>
                {qqData ? (
                  <div ref={qqRef}>
                    <QQPlot data={qqData} />
                    <div style={{ marginTop: 6 }}><PlotExportButton targetRef={qqRef} label="Export PNG" filenameBase={`qq-${Date.now()}`} /></div>
                  </div>
                ) : <div style={{ fontSize: 13 }}>Not enough data.</div>}
              </div>
              <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Bio vs Tech</div>
                {bioTechData ? (
                  <div ref={bioTechRef}>
                    <BioTechPlot data={bioTechData} />
                    <div style={{ marginTop: 6 }}><PlotExportButton targetRef={bioTechRef} label="Export PNG" filenameBase={`biotech-${Date.now()}`} /></div>
                  </div>
                ) : <div style={{ fontSize: 13 }}>No replicate info.</div>}
                {bioTechData?.warnings?.length ? (
                  <ul style={{ marginTop: 8, paddingLeft: 16, color: "#b45309", fontSize: 12 }}>
                    {bioTechData.warnings.map((w, idx) => (<li key={idx}>{w}</li>))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Missingness</div>
              <MissingTable missing={descriptive.missingness} />
            </div>

            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Outlier flags (IQR rule)</div>
              {descriptive.outliers.length === 0 ? <div style={{ fontSize: 13 }}>No outliers flagged (or insufficient data).</div> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 6 }}>Row</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Group</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Value</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descriptive.outliers.map((o, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ padding: 6 }}>{o.rowIndex + 1}</td>
                          <td style={{ padding: 6 }}>{o.group ?? "(unlabeled)"}</td>
                          <td style={{ padding: 6 }}>{o.value}</td>
                          <td style={{ padding: 6 }}>{o.method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {descriptive.controlComparisons.length > 0 && (
              <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Control comparisons</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 6 }}>Group</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Fold change</th>
                        <th style={{ textAlign: "left", padding: 6 }}>% change</th>
                        <th style={{ textAlign: "left", padding: 6 }}>log2 FC</th>
                        <th style={{ textAlign: "left", padding: 6 }}>Warnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descriptive.controlComparisons.map((c, idx) => (
                        <tr key={idx} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ padding: 6 }}>{c.group}</td>
                          <td style={{ padding: 6 }}>{c.foldChange ?? "-"}</td>
                          <td style={{ padding: 6 }}>{c.percentChange ?? "-"}</td>
                          <td style={{ padding: 6 }}>{c.log2FoldChange ?? "-"}</td>
                          <td style={{ padding: 6 }}>{c.warnings.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Interpretation</div>
              <InterpretationPanel blocks={descriptive.interpretation || []} />
            </div>

            {exportPayload && <AnalysisAudit payload={exportPayload} />}

            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Recommendations</div>
              {descriptive.recommendations.length === 0 ? <div style={{ fontSize: 13 }}>No recommendations yet.</div> : (
                <ul style={{ margin: 0, paddingLeft: 16, color: "#374151", fontSize: 13 }}>
                  {descriptive.recommendations.map((r, idx) => (
                    <li key={idx}><strong>{r.title}:</strong> {r.detail}</li>
                  ))}
                </ul>
              )}
            </div>

            {exportPayload && <ExportsPanel payload={exportPayload} />}

            {warnings.length > 0 && (
              <div className="panel" style={{ border: "1px solid #f87171", borderRadius: 12, padding: 12, background: "#fef2f2" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#b91c1c" }}>Warnings</div>
                <ul style={{ margin: 0, paddingLeft: 16, color: "#991b1b", fontSize: 13 }}>
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function isMissingCell(val: unknown) {

function isMissingCell(val: unknown) {
  if (val === null || val === undefined) return true;
  if (typeof val === "number") return Number.isNaN(val);
  if (typeof val === "string") return val.trim() === "" || ["na", "n/a", "null", "nan", "missing", "none", "-", "--"].includes(val.trim().toLowerCase());
  return false;
}

function Stat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, background: "#f9fafb" }}>
      <div style={{ fontSize: 13, color: "#374151" }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
      {helper && <div style={{ fontSize: 12, color: "#6b7280" }}>{helper}</div>}
    </div>
  );
}

function SummaryTable({ groups }: { groups: any[] }) {
  const metrics = ["n", "nonMissingCount", "missingCount", "mean", "median", "sd", "sem", "q1", "q3", "iqr", "min", "max", "range", "skewness", "kurtosis", "cvPercent", "ci95", "geometricMean", "mad"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 6 }}>Group</th>
            {metrics.map((m) => (
              <th key={m} style={{ textAlign: "left", padding: 6 }}>
                <MetricTooltip label={metricLabels[m]?.label || m} description={metricLabels[m]?.description || ""}>
                  <span>{metricLabels[m]?.label || m}</span>
                </MetricTooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, idx) => (
            <tr key={idx} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={{ padding: 6 }}>{g.group ?? "Overall"}</td>
              {metrics.map((m) => {
                const val = g.stats[m];
                if (m === "ci95") {
                  return <td key={m} style={{ padding: 6 }}>{val ? `${val.lower.toFixed(3)} – ${val.upper.toFixed(3)}` : "-"}</td>;
                }
                if (Array.isArray(val)) return <td key={m} style={{ padding: 6 }}>{val.join(", ") || "-"}</td>;
                if (val === null || val === undefined) return <td key={m} style={{ padding: 6 }}>-</td>;
                const num = typeof val === "number" ? Number(val) : val;
                return <td key={m} style={{ padding: 6 }}>{typeof num === "number" ? num.toFixed(3) : String(num)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingTable({ missing }: { missing: any }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div>Overall missing responses: {missing.overallMissing} / {missing.overallTotal}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6 }}>Group</th>
              <th style={{ textAlign: "left", padding: 6 }}>Missing</th>
              <th style={{ textAlign: "left", padding: 6 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(missing.byGroup).map(([g, v]: any) => (
              <tr key={g} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={{ padding: 6 }}>{g}</td>
                <td style={{ padding: 6 }}>{v.missing}</td>
                <td style={{ padding: 6 }}>{v.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
