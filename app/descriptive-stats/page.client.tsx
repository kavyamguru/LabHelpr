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
import { computeDescriptiveStats } from "../../lib/stats/descriptive/index";
import { DescriptiveResult, ReplicateMode } from "../../lib/stats/descriptive/types";
import { buildHistogramData, buildHistogramFacets, buildBoxData, buildViolinData, buildStripData, buildQQData, buildBioTechData } from "../../lib/stats/descriptive/chartData";
import { HistogramPlot, StripPlot, QQPlot } from "./components/plots/SimplePlots";
import { BoxPlot, ViolinPlot } from "./components/plots/SummaryPlots";
import { BioTechPlot } from "./components/plots/BioTechPlot";
import { InterpretationPanel } from "./components/InterpretationPanel";
import { metricLabels } from "../../lib/stats/descriptive/metricConfig";
import { MetricTooltip } from "./components/MetricTooltip";
import { ExportsPanel } from "./components/ExportsPanel";
import { AnalysisAudit } from "./components/AnalysisAudit";
import { buildExportPayload } from "../../lib/stats/descriptive/buildExportPayload";
import { PlotExportButton } from "./components/PlotExportButton";

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

function DescriptiveStatsPhase1() {
  const [rawText, setRawText] = useState(ELISA_SAMPLE);
  const [rawTable, setRawTable] = useState<ParsedTable | null>(null);
  const [normalized, setNormalized] = useState<ParsedTable | null>(null);
  const [analysisRows, setAnalysisRows] = useState<ParsedTable | null>(null);
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const histRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const violinRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const qqRef = useRef<HTMLDivElement | null>(null);
  const bioTechRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    handleParseText(rawText, "Sample: ELISA", "pasted");
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
    } catch (err) {
      console.error(err);
      setWarnings([err instanceof Error ? err.message : "Failed to parse"]);
    }
  }

  async function handleFile(file: File) {
    setWarnings([]);
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
      } else {
        throw new Error("Unsupported file type. Use CSV or Excel.");
      }
    } catch (err) {
      console.error(err);
      setWarnings([err instanceof Error ? err.message : "Failed to parse file"]);
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
      setWarnings([err instanceof Error ? err.message : "Failed to compute stats"]);
    }
  }, [normalized, mapping, replicateMode, collapseTechnical, controlGroup]);

  const histogramData = useMemo(() => (descriptive ? buildHistogramData(descriptive.analysisRows) : null), [descriptive]);
  const histogramFacets = useMemo(() => (descriptive ? buildHistogramFacets(descriptive.analysisRows) : {}), [descriptive]);
  const boxData = useMemo(() => (descriptive ? buildBoxData(descriptive.analysisRows) : null), [descriptive]);
  const violinData = useMemo(() => (descriptive ? buildViolinData(descriptive.analysisRows) : null), [descriptive]);
  const stripData = useMemo(() => (descriptive ? buildStripData(descriptive.analysisRows) : null), [descriptive]);
  const qqData = useMemo(() => (descriptive ? buildQQData(descriptive.analysisRows) : null), [descriptive]);
  const bioTechData = useMemo(() => (descriptive ? buildBioTechData(descriptive.analysisRows, descriptive.audit.replicateMode, descriptive.audit.collapseTechnical) : null), [descriptive]);
  const exportPayload = useMemo(() => (descriptive ? buildExportPayload(descriptive, { controlGroup, units: descriptive.audit.mapping.units ?? null }) : null), [descriptive, controlGroup]);

  return (
    <main className="calc-page" style={{ maxWidth: 1180 }}>
      {/* ... existing UI unchanged ... */}
    </main>
  );
}

export default DescriptiveStatsPhase1;
