"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ELISA_SAMPLE } from "./sampleData";
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
import { computeDescriptiveStats } from "../../lib/stats/descriptive/index";
import { DescriptiveResult, ReplicateMode } from "../../lib/stats/descriptive/types";
import { buildHistogramData, buildHistogramFacets, buildStripData, buildQQData, buildBioTechData } from "../../lib/stats/descriptive/chartData";
import { HistogramPlot, StripPlot, QQPlot } from "./components/plots/SimplePlots";
import { BioTechPlot } from "./components/plots/BioTechPlot";
import { PlotExportButton } from "./components/PlotExportButton";
import { InterpretationPanel } from "./components/InterpretationPanel";
import { metricLabels } from "../../lib/stats/descriptive/metricConfig";
import { MetricTooltip } from "./components/MetricTooltip";
import { ExportsPanel } from "./components/ExportsPanel";
import { AnalysisAudit } from "./components/AnalysisAudit";
import { buildExportPayload } from "../../lib/stats/descriptive/buildExportPayload";

const essentialMappingOrder: Array<{ key: keyof ColumnGuesses; label: string; helper?: string; required?: boolean }> = [
  { key: "response", label: "Response / measurement", helper: "Numeric outcome column", required: true },
  { key: "group", label: "Condition / treatment", helper: "Group/condition label", required: true },
  { key: "bioRep", label: "Biological replicate ID", helper: "Biological replicate identifier" },
  { key: "techRep", label: "Technical replicate ID", helper: "Technical replicate identifier" },
  { key: "dose", label: "Dose / concentration", helper: "Optional concentration" },
  { key: "time", label: "Timepoint", helper: "Optional timepoint" },
];

const optionalMappingOrder: Array<{ key: keyof ColumnGuesses; label: string; helper?: string }> = [
  { key: "controlFlag", label: "Control flag", helper: "Mark control rows" },
  { key: "units", label: "Units", helper: "Measurement units" },
  { key: "batch", label: "Batch / experiment date" },
  { key: "plate", label: "Plate ID" },
  { key: "well", label: "Well ID" },
  { key: "sampleId", label: "Sample ID" },
  { key: "cellLine", label: "Cell line" },
  { key: "genotype", label: "Genotype" },
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

function DescriptiveStatsClient() {
  const [rawText, setRawText] = useState(ELISA_SAMPLE);
  const [rawTable, setRawTable] = useState<ParsedTable | null>(null);
  const [normalized, setNormalized] = useState<ParsedTable | null>(null);
  const [analysisRows, setAnalysisRows] = useState<ParsedTable | null>(null);
  const [, setNotes] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnGuesses>({});
  const [replicateMode, setReplicateMode] = useState<ReplicateMode>("nested");
  const [collapseTechnical, setCollapseTechnical] = useState<boolean>(true);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState<boolean>(false);

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
  const [warnings, setWarnings] = useState<string[]>([]);  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<string>("Loaded ELISA sample");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const histRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const qqRef = useRef<HTMLDivElement | null>(null);
  const bioTechRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    handleParseText(rawText, "Sample: ELISA", "pasted");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateAuditUserMapping = useCallback(
    (nextMapping: ColumnGuesses) => {
      setAudit((prev) => ({
        ...prev,
        userMappings: nextMapping,
        unitColumn: nextMapping.units,
        replicateMode,
        collapseTechnical,
      }));
    },
    [replicateMode, collapseTechnical]
  );

  function handleParseText(text: string, origin: string, source: IngestionSourceType = "pasted") {
    try {
      setError("");
      const result = ingestDelimited(text, source);
      setRawTable(result.raw);
      setNormalized(result.normalized);
      setAnalysisRows(result.normalized);
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

  const headers = useMemo(() => normalized?.headers || rawTable?.headers || [], [normalized?.headers, rawTable?.headers]);
  const _preview = useMemo(() => (normalized ? previewRows(normalized.rows) : []), [normalized]);
  const _missingSummary = useMemo(() => (normalized ? summarizeMissing(normalized.rows, headers) : {}), [normalized, headers]);

  const groupCounts = useMemo(() => {
    if (!normalized || !mapping.group) return { groups: 0, labels: [] as string[] };
    const labels = Array.from(new Set(normalized.rows.map((r) => String(r[mapping.group as string] ?? "").trim()).filter(Boolean)));
    return { groups: labels.length, labels };
  }, [normalized, mapping.group]);

  useEffect(() => {
    if (!controlGroup && groupCounts.labels.includes("Control")) {
      setControlGroup("Control");
    }
  }, [groupCounts.labels, controlGroup]);

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
  }, [mapping, updateAuditUserMapping]);

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
  }, [normalized, mapping, replicateMode, collapseTechnical, controlGroup, audit.missingTokens, audit.sourceType, audit.inferredStructure, audit.notes]);

  const histogramData = useMemo(() => (descriptive ? buildHistogramData(descriptive.analysisRows) : null), [descriptive]);
  const _histogramFacets = useMemo(() => (descriptive ? buildHistogramFacets(descriptive.analysisRows) : {}), [descriptive]);
  const stripData = useMemo(() => (descriptive ? buildStripData(descriptive.analysisRows) : null), [descriptive]);
  const qqData = useMemo(() => (descriptive ? buildQQData(descriptive.analysisRows) : null), [descriptive]);
  const bioTechData = useMemo(() => (descriptive ? buildBioTechData(descriptive.analysisRows, descriptive.audit.replicateMode, descriptive.audit.collapseTechnical) : null), [descriptive]);
  const exportPayload = useMemo(() => (descriptive ? buildExportPayload(descriptive, { controlGroup, units: descriptive.audit.mapping.units ?? null }) : null), [descriptive, controlGroup]);
  const controlMean = useMemo(() => {
    if (!descriptive || !controlGroup) return null;
    const g = descriptive.byGroup.find((g) => g.group === controlGroup);
    return g?.stats.mean ?? null;
  }, [descriptive, controlGroup]);

  return (
    <main className="calc-page" style={{ maxWidth: 1180, paddingBottom: 16 }}>
      <header className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>Descriptive statistics</h1>
        </div>
      </header>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 4, marginTop: 0 }}>Paste or upload</div>
        <div>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 160, fontFamily: "monospace" }}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted) {
                e.preventDefault();
                setRawText(pasted);
                handleParseText(pasted, "pasted data", "pasted");
              }
            }}
            placeholder="Paste CSV / TSV / table"
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <button className="primary" type="button" onClick={() => handleParseText(rawText, "pasted data", "pasted")}>Parse</button>
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
              Upload file
            </label>
            <button className="ghost-button" type="button" onClick={() => { setRawText(ELISA_SAMPLE); handleParseText(ELISA_SAMPLE, "Example", "pasted"); }}>Try example</button>
          </div>
          {status && <div style={{ marginTop: 6, color: "#166534", fontWeight: 600 }}>{status}</div>}
          {error && <div style={{ marginTop: 6, color: "#b91c1c", fontWeight: 600 }}>{error}</div>}
        </div>
      </section>

      {normalized && (
        <section className="calc-card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 4, marginTop: 0 }}>2) Map columns & replicates</div>
          <p style={{ marginTop: 4, color: "#4b5563", fontSize: 13, lineHeight: 1.5 }}>Map essentials first, then expand advanced fields if needed. Biological replicates are the reporting unit.</p>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {essentialMappingOrder.map((m) => (
                  <MappingSelect
                    key={m.key}
                    label={m.label + (m.required ? " *" : "")}
                    helper={m.helper}
                    value={mapping[m.key]}
                    options={headers}
                    onChange={(v) => setMapping((prev) => ({ ...prev, [m.key]: v }))}
                  />
                ))}
              </div>
              <div>
                <button type="button" className="ghost-button" onClick={() => setShowAdvancedMapping((v) => !v)}>
                  {showAdvancedMapping ? "Hide optional/advanced mappings" : "Show optional/advanced mappings"}
                </button>
                {showAdvancedMapping && (
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                    {optionalMappingOrder.map((m) => (
                      <MappingSelect
                        key={m.key}
                        label={m.label}
                        helper={m.helper}
                        value={mapping[m.key]}
                        options={headers}
                        onChange={(v) => setMapping((prev) => ({ ...prev, [m.key]: v }))}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={infoBox}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Replicates</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {([
                    { key: "nested", label: "Nested (bio > tech)", desc: "Biological reps with nested technical reps (recommended)" },
                    { key: "biological", label: "Biological only", desc: "Only biological replicate IDs provided" },
                    { key: "technical", label: "Technical only", desc: "Only technical replicate IDs (bio inference limited)" },
                    { key: "none", label: "No replicates", desc: "Treat every row as independent measurement" },
                  ] as { key: ReplicateMode; label: string; desc: string }[]).map((opt) => (
                    <label key={opt.key} className="pill" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: replicateMode === opt.key ? "#eef2ff" : "#f8fafc", border: "1px solid #e5e7eb", padding: "6px 10px", borderRadius: 12 }}>
                      <input type="radio" name="repMode" value={opt.key} checked={replicateMode === opt.key} onChange={() => setReplicateMode(opt.key)} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: "#4b5563" }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {replicateMode !== "none" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                    <input type="checkbox" checked={collapseTechnical} onChange={(e) => setCollapseTechnical(e.target.checked)} />
                    <span>Average technical replicates within each biological replicate before group summaries</span>
                  </label>
                )}
                {replicateMode === "technical" && (
                  <div style={{ marginTop: 8, color: "#b45309", fontSize: 12, fontWeight: 700 }}>Warning: technical-only mode limits biological inference.</div>
                )}
                {replicateMode === "none" && (
                  <div style={{ marginTop: 8, color: "#b45309", fontSize: 12 }}>No replicate IDs provided; each row treated independently.</div>
                )}
              </div>
              <div style={infoBox}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Control group</div>
                <select className="input" value={controlGroup ?? ""} onChange={(e) => setControlGroup(e.target.value || undefined)}>
                  <option value="">None</option>
                  {groupCounts.labels.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
                  {controlGroup ? "Control comparisons enabled (fold/percent changes)." : "Select a control to enable comparisons."}
                </div>
                {controlGroup && controlMean !== null && Math.abs(controlMean) < 1e-6 && (
                  <div style={{ marginTop: 6, color: "#b45309", fontSize: 12 }}>Warning: control mean is near zero; fold/percent changes may be unstable.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {normalized && (
        <section className="calc-card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 4, marginTop: 0 }}>3) Data quality & structure</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
            <Stat label="Raw measurements" value={`${rowCounts.raw}`} helper="Rows uploaded" />
            <Stat label="Valid numeric values" value={`${rowCounts.normalized}`} helper="Usable response rows after parsing" />
            <Stat label="Biological samples used for analysis" value={`${rowCounts.analysis}`} helper="If tech repeats collapsed, this reflects biological n" />
            <Stat label="Groups detected" value={`${groupCounts.groups}`} helper={groupCounts.labels.join(", ") || "-"} />
            <Stat label="Biological replicate IDs" value={`${bioTechCounts.nBio}`} helper={`Technical repeats detected: ${bioTechCounts.nTech}`} />
            <Stat label="Avg tech per bio" value={bioTechCounts.avgTechPerBio ? bioTechCounts.avgTechPerBio.toFixed(2) : "-"} helper="Higher values indicate multiple technicals per bio rep" />
          </div>
          {descriptive?.missingness && <MissingTable missing={descriptive.missingness} />}
        </section>
      )}

      {descriptive && (
        <section className="calc-card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 4, marginTop: 0 }}>4) Summary statistics</div>
          <p style={{ marginTop: 4, color: "#4b5563", fontSize: 14 }}>Overall plus per-group summaries; replicate-aware.</p>
          <SummaryTable groups={[descriptive.overall, ...descriptive.byGroup]} />
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Control comparisons</div>
            {descriptive.controlComparisons?.length ? (
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                {descriptive.controlComparisons.map((c, idx) => (
                  <li key={idx}>
                    {c.group} vs {c.controlGroup}: fold {c.foldChange ?? "-"}, percent {c.percentChange ?? "-"}, log2 {c.log2FoldChange ?? "-"}
                    {c.warnings?.length ? ` — ${c.warnings.join("; ")}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 13 }}>Select a control group (e.g., "Control") to enable fold/percent comparisons.</div>
            )}
          </div>
        </section>
      )}

      {descriptive && (
        <section className="calc-card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 4, marginTop: 0 }}>5) Visualizations</div>
          <p style={{ marginTop: 4, color: "#4b5563", fontSize: 13, lineHeight: 1.5 }}>Stable plots only: histogram (group overlay), strip (with outliers), Q-Q with reference line, and bio vs tech replicate view.</p>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>Distribution of your measurements</div>
                <PlotExportButton targetRef={histRef} label="Export PNG" filenameBase="histogram" />
              </div>
              <div ref={histRef as any}>{histogramData ? <HistogramPlot data={histogramData} /> : <div style={{ fontSize: 13 }}>Not enough data.</div>}</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>Individual values by group</div>
                <PlotExportButton targetRef={stripRef} label="Export PNG" filenameBase="strip" />
              </div>
              <div ref={stripRef as any}>{stripData ? <StripPlot data={stripData} /> : <div style={{ fontSize: 13 }}>Not enough data.</div>}</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>Normality check (Q-Q plot)</div>
                <PlotExportButton targetRef={qqRef} label="Export PNG" filenameBase="qq" />
              </div>
              <div ref={qqRef as any}>{qqData ? <QQPlot data={qqData} /> : <div style={{ fontSize: 13 }}>Not enough data (requires ≥5 observations). </div>}</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>Biological samples and repeated measurements</div>
                <PlotExportButton targetRef={bioTechRef} label="Export PNG" filenameBase="biotech" />
              </div>
              <div ref={bioTechRef as any}>{bioTechData ? <BioTechPlot data={bioTechData} collapsed={collapseTechnical} /> : <div style={{ fontSize: 13 }}>Not enough data.</div>}</div>
              <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
                {collapseTechnical ? "Technical replicates collapsed to biological means." : "Technical replicates shown; they are not biological n."}
              </div>
            </div>
          </div>
        </section>
      )}

      {descriptive && exportPayload && (
        <section className="calc-card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 4, marginTop: 0 }}>6) Interpretation & exports</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Interpretation</div>
              <InterpretationPanel blocks={descriptive.interpretation || []} />
            </div>
            <ExportsPanel payload={exportPayload} />
            <AnalysisAudit payload={exportPayload} />
          </div>
        </section>
      )}

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
    </main>
  );
}

function SummaryTable({ groups }: { groups: any[] }) {
  const basicMetrics = ["n", "mean", "median", "sd", "iqr", "min", "max", "cvPercent", "ci95"];
  const advancedMetrics = ["variance", "range", "q1", "q3", "skewness", "kurtosis", "geometricMean", "mad", "trimmedMean", "nonMissingCount", "missingCount"];
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const metrics = showAdvanced ? [...basicMetrics, ...advancedMetrics] : basicMetrics;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Metrics</div>
        <button type="button" className="ghost-button" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide advanced metrics" : "Show advanced metrics"}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6, position: "sticky", left: 0, background: "#fff" }}>Group</th>
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
                <td style={{ padding: 6, position: "sticky", left: 0, background: "#fff" }}>{g.group ?? "Overall"}</td>
                {metrics.map((m) => {
                  const val = g.stats[m];
                  if (m === "ci95") {
                    return <td key={m} style={{ padding: 6 }}>{val ? `${val.lower.toFixed(3)} – ${val.upper.toFixed(3)}` : "-"}</td>;
                  }
                  if (val === null || val === undefined) return <td key={m} style={{ padding: 6 }}>-</td>;
                  if (Array.isArray(val)) return <td key={m} style={{ padding: 6 }}>{val.join(", ") || "-"}</td>;
                  const num = typeof val === "number" ? Number(val) : val;
                  return <td key={m} style={{ padding: 6 }}>{typeof num === "number" ? num.toFixed(3) : String(num)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function Stat({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, background: "#f9fafb" }}>
      <div style={{ fontSize: 13, color: "#374151" }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
      {helper && <div style={{ fontSize: 12, color: "#6b7280" }}>{helper}</div>}
    </div>
  );
}

export default DescriptiveStatsClient;
