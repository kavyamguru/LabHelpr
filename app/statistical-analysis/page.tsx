"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toPng, toSvg } from "html-to-image";
import JSZip from "jszip";
import { quantileSorted } from "simple-statistics";
import { Bar } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  BarElement,
} from "chart.js";
import { QqPlot } from "./QqPlot";
import packageJson from "../../package.json" assert { type: "json" };
import {
  computeGroupStats,
  computeFoldChanges,
  ReplicateType,
  TechnicalHandling,
  MissingHandling,
  Transform,
  ComputeOptions,
  GroupStats,
  VarianceConvention,
} from "../../lib/stats/descriptive";
import { formatNumber as fmt, defaultFormat } from "../../lib/stats/formatting";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Legend, Tooltip);

type RawRow = {
  rowId: number;
  group: string;
  bioRep?: string;
  techRep?: string;
  value?: number;
  unit?: string;
  rawValue: string;
  issues: string[];
};

const defaultTemplate = `group,bio_rep,tech_rep,value,unit
Control,B1,T1,2.4,ng/mL
Control,B1,T2,2.6,ng/mL
Control,B2,T1,2.1,ng/mL
Treatment,B1,T1,5.3,ng/mL
Treatment,B1,T2,5.0,ng/mL
Treatment,B2,T1,4.7,ng/mL`;

function parsePastedData(input: string): RawRow[] {
  if (!input.trim()) return [];
  const parsed = Papa.parse<string[]>(input.trim(), {
    delimiter: /,|\t/,
    skipEmptyLines: true,
  });
  const rows: RawRow[] = [];
  const headers = parsed.data[0]?.map((h) => h.trim().toLowerCase());
  const hasHeader = headers?.some((h) => ["group", "bio_rep", "tech_rep", "value", "unit"].includes(h ?? ""));
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const cell = (idx: number) => (row?.[idx] ?? "").trim();
    const group = hasHeader && headers ? cell(headers.indexOf("group")) || "Ungrouped" : cell(0) || "Ungrouped";
    const bioRep = hasHeader && headers && headers.includes("bio_rep") ? cell(headers.indexOf("bio_rep")) || undefined : cell(1) || undefined;
    const techRep = hasHeader && headers && headers.includes("tech_rep") ? cell(headers.indexOf("tech_rep")) || undefined : cell(2) || undefined;
    let rawValue = "";
    if (hasHeader && headers) {
      const valIdx = headers.indexOf("value");
      rawValue = valIdx >= 0 ? cell(valIdx) : cell(headers.length - 1);
    } else {
      rawValue = cell(3);
    }
    const unit = hasHeader && headers && headers.includes("unit") ? cell(headers.indexOf("unit")) || undefined : cell(4) || undefined;

    const issues: string[] = [];
    const numericValue = rawValue ? Number(rawValue) : undefined;
    if (rawValue === "" || rawValue === undefined) issues.push("Missing numeric value");
    if (rawValue !== "" && rawValue !== undefined && Number.isNaN(numericValue)) issues.push("Non-numeric value");

    rows.push({
      rowId: i,
      group: group || "Ungrouped",
      bioRep: bioRep || undefined,
      techRep: techRep || undefined,
      value: Number.isFinite(numericValue!) ? numericValue : undefined,
      unit,
      rawValue,
      issues,
    });
  }
  return rows;
}

function sanitizeRows(rows: RawRow[], missingHandling: MissingHandling): { usable: RawRow[]; removed: RawRow[] } {
  if (missingHandling === "ignore") {
    return {
      usable: rows.filter((r) => r.value !== undefined && !Number.isNaN(r.value)),
      removed: rows.filter((r) => r.value === undefined || Number.isNaN(r.value)),
    };
  }

  // drop replicate if any missing within bioRep
  const groupedByBio = rows.reduce<Record<string, RawRow[]>>((acc, row) => {
    const key = row.bioRep || `row-${row.rowId}`;
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});

  const usable: RawRow[] = [];
  const removed: RawRow[] = [];
  Object.values(groupedByBio).forEach((items) => {
    const hasMissing = items.some((r) => r.value === undefined || Number.isNaN(r.value));
    if (hasMissing) {
      removed.push(...items);
    } else {
      usable.push(...items);
    }
  });
  return { usable, removed };
}

// computations moved to lib/stats/descriptive

function useFormatter(options: typeof defaultFormat) {
  return {
    format: (value: number | null | undefined, sigOverride?: number) =>
      fmt(value, { ...options, sigFigs: sigOverride ?? options.sigFigs }),
  };
}

const numberInputStyle = { width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 8 } as const;

function useFileReader(onText: (text: string) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) onText(text.toString());
      };
      reader.readAsText(file);
    };
    const fileInputs = document.querySelectorAll<HTMLInputElement>("input[data-stat-upload]");
    fileInputs.forEach((input) => input.addEventListener("change", handler));
    return () => fileInputs.forEach((input) => input.removeEventListener("change", handler));
  }, [onText]);
}

export default function StatisticalAnalysisPage() {
  const [rawInput, setRawInput] = useState(defaultTemplate);
  const [missingHandling, setMissingHandling] = useState<MissingHandling>("ignore");
  const [replicateType, setReplicateType] = useState<ReplicateType>("biological");
  const [technicalHandling, setTechnicalHandling] = useState<TechnicalHandling>("average");
  const [transform, setTransform] = useState<Transform>("none");
  const [allowNonPositiveLog, setAllowNonPositiveLog] = useState(false);
  const [referenceGroup, setReferenceGroup] = useState<string>("Control");
  const [units, setUnits] = useState<string>("unitless");
  const [showModes, setShowModes] = useState(false);
  const [varianceConvention, setVarianceConvention] = useState<VarianceConvention>("sample");
  const [iqrMultiplier, setIqrMultiplier] = useState<number>(1.5);
  const [formatOptions, setFormatOptions] = useState(defaultFormat);
  const [showQq, setShowQq] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [buildingReport, setBuildingReport] = useState(false);

  const histogramRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const exportFigure = async (ref: { current: HTMLDivElement | null }, filename: string, format: "png" | "svg") => {
    if (!ref.current) return;
    if (!units.trim()) {
      alert("Please set units (or 'unitless') before exporting figures.");
      return;
    }
    try {
      if (format === "png") {
        const dataUrl = await toPng(ref.current, { pixelRatio: 3 });
        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        link.click();
      } else {
        const dataUrl = await toSvg(ref.current, { pixelRatio: 3 });
        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  useFileReader((text) => setRawInput(text));

  const parsedRows = useMemo(() => parsePastedData(rawInput), [rawInput]);
  const { usable, removed } = useMemo(() => sanitizeRows(parsedRows, missingHandling), [parsedRows, missingHandling]);

  const computeOpts: ComputeOptions = useMemo(
    () => ({
      replicateType,
      technicalHandling,
      missingHandling,
      transform,
      allowNonPositiveLog,
      varianceConvention,
      iqrMultiplier,
      ciMethod: "t95",
    }),
    [replicateType, technicalHandling, missingHandling, transform, allowNonPositiveLog, varianceConvention, iqrMultiplier]
  );

  const { format } = useFormatter(formatOptions);

  const { stats, warnings } = useMemo(() => computeGroupStats(usable, computeOpts), [usable, computeOpts]);

  const safeReferenceGroup = stats.some((s) => s.group === referenceGroup)
    ? referenceGroup
    : stats.length > 0
    ? stats[0].group
    : referenceGroup;

  const foldChanges = useMemo(() => computeFoldChanges(stats, safeReferenceGroup), [stats, safeReferenceGroup]);

  const bioKeys = useMemo(() => new Set(usable.map((r) => r.bioRep || `bio-${r.rowId}`)), [usable]);
  const nBioTotal = bioKeys.size;
  const nTechTotal = useMemo(() => usable.filter((r) => r.techRep !== undefined).length, [usable]);
  const avgTechPerBio = nBioTotal > 0 ? nTechTotal / nBioTotal : 0;
  const techMissingBio = useMemo(
    () =>
      replicateType === "technical" &&
      usable.some((u) => u.techRep && !u.bioRep),
    [replicateType, usable]
  );
  const unitsFromData = useMemo(() => {
    const set = new Set(usable.map((u) => (u.unit || "").trim()).filter(Boolean));
    return set;
  }, [usable]);
  const mixedUnits = unitsFromData.size > 1;

  const methodsSnippet = useMemo(() => {
    const parts = [
      `Data are presented as mean ± SD (${varianceConvention === "sample" ? "sample SD, n−1" : "population SD, n"}) unless otherwise stated.`,
      `Sample size (n) represents independent ${replicateType === "biological" ? "biological" : "biological (technical replicates accounted as " + technicalHandling + ")"} replicates.`,
      missingHandling === "ignore"
        ? "Rows with missing values were excluded; other replicates retained."
        : "Biological replicates containing missing values were excluded in full.",
      transform !== "none" ? `Log${transform === "log2" ? "₂" : "₁₀"} transformation applied where indicated.` : "No transformation applied.",
      "Fold changes were calculated relative to the selected reference group.",
      "Normality hint: heuristic only; not inferential.",
      `Outliers flagged via ${iqrMultiplier}×IQR; never removed automatically.`,
      `Variance convention: ${varianceConvention === "sample" ? "sample (n−1)" : "population (n)"}.`,
      "95% CI (if shown): t-based on df = n_bio − 1.",
    ];
    return parts.join(" ");
  }, [replicateType, technicalHandling, missingHandling, transform, iqrMultiplier, varianceConvention]);

  const resultsSnippet = useMemo(() => {
    if (stats.length === 0) return "";
    return stats
      .map((g) => {
        return `${g.group}: mean ${format(g.mean)} ± SD ${format(g.sd)}, n_bio=${g.nBio}.`;
      })
      .join(" ");
  }, [stats, format]);

  const transparencyLog = useMemo(() => {
    const items = [] as string[];
    items.push(`Replicate declaration: ${replicateType === "biological" ? "Biological replicates define n" : "Technical replicates provided; n = biological replicates"}.`);
    if (replicateType === "technical") {
      items.push(`Technical handling: ${technicalHandling === "average" ? "Averaged within each biological replicate" : "Reported separately (n still counts biological replicates)"}.`);
      const missingBio = usable.some((u) => !u.bioRep);
      if (missingBio) items.push("bio_rep is missing for some rows; counted as unique rows. Provide bio_rep to define n accurately.");
    }
    items.push(`Missing data handling: ${missingHandling === "ignore" ? "Ignored row-level missing values" : "Excluded entire biological replicate if any value missing"}.`);
    items.push(`Transformation: ${transform === "none" ? "None" : `Log transform (${transform})`} ${transform !== "none" && allowNonPositiveLog ? "(non-positive values excluded/adjusted)" : ""}.`);
    items.push(`Variance convention: ${varianceConvention === "sample" ? "sample (n−1)" : "population (n)"}.`);
    items.push("CI method: 95% CI using t-distribution (df = n_bio − 1).");
    items.push("Normality hint is heuristic (Shapiro approx + QQ plot optional); not inferential.");
    if (warnings.length > 0) items.push(...warnings);
    if (removed.length > 0) items.push(`Removed ${removed.length} row(s) due to missing/invalid values.`);
    return items;
  }, [replicateType, technicalHandling, missingHandling, transform, allowNonPositiveLog, warnings, removed, usable, varianceConvention]);

  const manifestBase = useMemo(
    () => ({
      app: "LabHelpr",
      version: packageJson.version,
      commit: (process.env.NEXT_PUBLIC_COMMIT || null) as string | null,
    }),
    []
  );

  const buildReviewerMarkdown = useCallback(() => {
    const lines: string[] = [];
    lines.push(`# Reviewer Report`);
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`App: LabHelpr v${packageJson.version}${manifestBase.commit ? ` (commit ${manifestBase.commit})` : ""}`);
    lines.push("");
    lines.push(`## Dataset summary`);
    lines.push(`Groups: ${stats.length}`);
    lines.push(`n_bio total: ${nBioTotal}; n_tech total: ${nTechTotal}; avg tech/bio: ${format(avgTechPerBio, 2)}`);
    lines.push(`Units: ${units.trim() || "(not set)"}`);
    lines.push("");
    lines.push(`## Policies`);
    lines.push(`- Missing data: ${missingHandling === "ignore" ? "Ignored rows with missing values" : "Excluded entire biological replicate if any value missing"}`);
    lines.push(`- Replicates: ${replicateType === "biological" ? "Biological replicates define n" : `Technical provided; n = biological (mode: ${technicalHandling})`}`);
    lines.push(`- Transformation: ${transform === "none" ? "None" : `Log transform (${transform})`} ${transform !== "none" && allowNonPositiveLog ? "(non-positive excluded/adjusted)" : ""}`);
    lines.push(`- Variance convention: ${varianceConvention === "sample" ? "sample (n−1)" : "population (n)"}`);
    lines.push(`- Outliers: IQR fence = ${iqrMultiplier}× (flagged only, never removed)`);
    lines.push(`- Normality: heuristic (Shapiro approx + optional QQ plot); not inferential.`);
    lines.push(`- CI: 95% CI uses t-distribution, df = n_bio − 1.`);
    lines.push("");
    lines.push(`## Descriptive statistics`);
    lines.push(`| Group | n_bio | Mean | SD | Median | Min | Max | Range | IQR fence | 95% CI (if available) | Normality hint |`);
    lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`);
    stats.forEach((g) => {
      const ci = g.ci95 ? `${format(g.ci95.low)} to ${format(g.ci95.high)} (df=${g.ci95.df})` : "—";
      const norm = g.normality.w ? `${g.normality.label} · W=${format(g.normality.w)}` : "n<3";
      lines.push(
        `| ${g.group} | ${g.nBio} | ${format(g.mean)} | ${format(g.sd)} | ${format(g.median)} | ${format(g.min)} | ${format(g.max)} | ${format(g.range)} | ${g.iqrMultiplier}× | ${ci} | ${norm} |`
      );
    });
    lines.push("");
    lines.push(`## Figure legend templates`);
    lines.push(`- Histogram: Values (${units}) by group; bins show counts; ${stats.length} groups; n_bio per group shown in tables.`);
    lines.push(`- Box/whisker: Box = IQR, whiskers = ${iqrMultiplier}×IQR fences; outliers flagged, not removed; median line; per-group n_bio shown.`);
    lines.push(`- Error bars: Mean ± SD (default) and SEM; 95% CI (t-based) shown when available; n_bio in labels.`);
    lines.push("");
    lines.push(`## Methods snippet`);
    lines.push(methodsSnippet);
    lines.push("");
    lines.push(`## Results snippet`);
    lines.push(resultsSnippet || "(not computed)");
    lines.push("");
    lines.push(`## Transparency log`);
    transparencyLog.forEach((t) => lines.push(`- ${t}`));
    return lines.join("\n");
  }, [stats, nBioTotal, nTechTotal, avgTechPerBio, units, missingHandling, replicateType, technicalHandling, transform, allowNonPositiveLog, varianceConvention, iqrMultiplier, methodsSnippet, resultsSnippet, transparencyLog, format, manifestBase.commit]);

  const handleReviewerReport = useCallback(() => {
    if (!units.trim()) {
      alert("Set units (or 'unitless') before exporting.");
      return;
    }
    if (stats.length === 0) {
      alert("Add data and compute stats before exporting.");
      return;
    }
    setBuildingReport(true);
    try {
      const md = buildReviewerMarkdown();
      const blob = new Blob([md], { type: "text/markdown" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `labhelpr-reviewer-report-${new Date().toISOString().replace(/[:.]/g, "-")}.md`;
      link.click();
    } finally {
      setBuildingReport(false);
    }
  }, [buildReviewerMarkdown, stats.length, units]);

  const handleBundleExport = useCallback(async () => {
    if (!units.trim()) {
      alert("Set units (or 'unitless') before exporting.");
      return;
    }
    if (stats.length === 0) {
      alert("Add data and compute stats before exporting.");
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      const enc = new TextEncoder();
      const hashes: Record<string, string> = {};
      const addText = async (path: string, content: string) => {
        zip.file(path, content);
        const digest = await crypto.subtle.digest("SHA-256", enc.encode(content));
        hashes[path] = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      };

      await addText("raw_input.csv", rawInput, hashes);

      const cleanedCsv = ["group,bio_rep,tech_rep,value,unit"].concat(
        usable.map((r) => `${r.group ?? ""},${r.bioRep ?? ""},${r.techRep ?? ""},${r.value ?? ""},${r.unit ?? ""}`)
      );
      await addText("cleaned_data.csv", cleanedCsv.join("\n"), hashes);

      const replicateMap = usable.map((r) => ({ group: r.group, bio_rep: r.bioRep, tech_rep: r.techRep, value: r.value, unit: r.unit }));
      await addText("replicate_mapping.json", JSON.stringify(replicateMap, null, 2), hashes);

      const decisions = {
        missingHandling,
        replicateType,
        technicalHandling,
        transform,
        allowNonPositiveLog,
        varianceConvention,
        iqrMultiplier,
        units,
        warnings,
        removedRows: removed,
        notes: ["SEM/CI use n_bio", "Normality hint heuristic only"],
      };
      await addText("decisions.json", JSON.stringify(decisions, null, 2), hashes);

      const resultsJson = stats.map((g) => ({
        group: g.group,
        n_bio: g.nBio,
        n_tech: g.nTech,
        mean: g.mean,
        median: g.median,
        modes: g.modes,
        sd: g.sd,
        variance: g.variance,
        sem: g.sem,
        cv: g.cv,
        min: g.min,
        max: g.max,
        range: g.range,
        ci95: g.ci95,
        normality: g.normality,
        iqrMultiplier: g.iqrMultiplier,
      }));
      await addText("results.json", JSON.stringify(resultsJson, null, 2), hashes);

      const resultsCsvHeader = "group,n_bio,n_tech,mean,median,sd,variance,sem,cv,min,max,range,ci95_low,ci95_high,ci_df";
      const resultsCsv = [
        resultsCsvHeader,
        ...stats.map((g) =>
          [
            g.group,
            g.nBio,
            g.nTech,
            g.mean,
            g.median,
            g.sd,
            g.variance,
            g.sem,
            g.cv,
            g.min,
            g.max,
            g.range,
            g.ci95?.low ?? "",
            g.ci95?.high ?? "",
            g.ci95?.df ?? "",
          ].join(",")
        ),
      ];
      await addText("results.csv", resultsCsv.join("\n"), hashes);

      await addText("methods.md", `# Methods\n${methodsSnippet}\n`, hashes);
      await addText("results.md", `# Results\n${resultsSnippet}\n`, hashes);

      const pngSvg = async (ref: React.RefObject<HTMLDivElement>, name: string) => {
        if (!ref.current) return;
        const pngUrl = await toPng(ref.current, { pixelRatio: 3 });
        const svgUrl = await toSvg(ref.current, { pixelRatio: 3 });
        const pngData = atob(pngUrl.split(",")[1]);
        const svgData = atob(svgUrl.split(",")[1]);
        const pngArray = Uint8Array.from(pngData, (c) => c.charCodeAt(0));
        const svgArray = Uint8Array.from(svgData, (c) => c.charCodeAt(0));
        zip.file(`figures/${name}.png`, pngArray);
        zip.file(`figures/${name}.svg`, svgArray);
        const hashPng = await crypto.subtle.digest("SHA-256", pngArray);
        const hashSvg = await crypto.subtle.digest("SHA-256", svgArray);
        hashes[`figures/${name}.png`] = Array.from(new Uint8Array(hashPng)).map((b) => b.toString(16).padStart(2, "0")).join("");
        hashes[`figures/${name}.svg`] = Array.from(new Uint8Array(hashSvg)).map((b) => b.toString(16).padStart(2, "0")).join("");
      };

      await pngSvg(histogramRef, "histogram");
      await pngSvg(boxRef, "boxplot");
      await pngSvg(errorRef, "errorbars");

      const manifest = {
        ...manifestBase,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        hashes,
        options: computeOpts,
      };
      await addText("manifest.json", JSON.stringify(manifest, null, 2), hashes);

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `labhelpr-analysis-bundle-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
      link.click();
    } catch (err) {
      console.error("Bundle export failed", err);
      alert("Bundle export failed; see console.");
    } finally {
      setExporting(false);
    }
  }, [units, stats, rawInput, usable, removed, warnings, methodsSnippet, resultsSnippet, manifestBase, computeOpts, histogramRef, boxRef, errorRef, missingHandling, replicateType, technicalHandling, transform, allowNonPositiveLog, varianceConvention, iqrMultiplier]);

  return (
    <main className="calc-page" style={{ minHeight: "100vh", paddingBottom: 48 }}>
      <header className="calc-card" style={{ maxWidth: 1100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Basic Descriptive Statistics (LabHelpr)</div>
            <div style={{ color: "#555", marginTop: 4 }}>
              Publication-grade descriptive stats with mandatory clarity for biological vs technical replicates.
            </div>
          </div>
          <div className="pill" style={{ background: "#eef2ff", color: "#4338ca", fontWeight: 700 }}>
            Descriptive only · No hypothesis testing
          </div>
        </div>
      </header>

      <section className="calc-card" style={{ maxWidth: 1100, marginTop: 16 }}>
        <div className="section-title">1) Data ingestion & replicate declaration</div>
        <div className="grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div>
            <label className="label">Paste data (CSV or tab-separated)</label>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="input"
              rows={10}
              style={{ width: "100%", fontFamily: "monospace" }}
              placeholder="group,bio_rep,tech_rep,value,unit"
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
              <label className="upload" style={{ cursor: "pointer", color: "#2563eb", fontWeight: 600 }}>
                <input type="file" data-stat-upload accept=".csv,.tsv,text/csv,text/tab-separated-values" style={{ display: "none" }} />
                Upload CSV
              </label>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setRawInput(defaultTemplate)}
                style={{ fontSize: 13 }}
              >
                Load example template
              </button>
            </div>
            <p className="helper" style={{ marginTop: 8 }}>
              Expected columns: group (optional, default “Ungrouped”), bio_rep (required for technical replicates), tech_rep (optional), value (numeric), unit (optional).
            </p>
          </div>

          <div className="panel" style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>Replicate declaration (mandatory)</div>
            <div className="radio-group">
              <label className="radio">
                <input
                  type="radio"
                  name="rep-type"
                  checked={replicateType === "biological"}
                  onChange={() => setReplicateType("biological")}
                />
                Biological replicates (n counts these) — Default
              </label>
              <label className="radio">
                <input
                  type="radio"
                  name="rep-type"
                  checked={replicateType === "technical"}
                  onChange={() => setReplicateType("technical")}
                />
                Technical replicates provided (n still counts biological replicates)
              </label>
            </div>

            {replicateType === "technical" && (
              <div style={{ marginTop: 10 }}>
                <div className="label">Technical replicate handling</div>
                <div className="radio-group">
                  <label className="radio">
                    <input
                      type="radio"
                      name="tech-handling"
                      checked={technicalHandling === "average"}
                      onChange={() => setTechnicalHandling("average")}
                    />
                    Average technical replicates within each biological replicate (recommended)
                  </label>
                  <label className="radio">
                    <input
                      type="radio"
                      name="tech-handling"
                      checked={technicalHandling === "separate"}
                      onChange={() => setTechnicalHandling("separate")}
                    />
                    Report technical replicates separately (n still = biological replicates)
                  </label>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="label">Missing data handling</div>
              <select
                className="input"
                value={missingHandling}
                onChange={(e) => setMissingHandling(e.target.value as MissingHandling)}
              >
                <option value="ignore">Ignore rows with missing values (default)</option>
                <option value="drop-replicate">Exclude entire biological replicate if any value is missing</option>
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Transformations (explicit opt-in)</div>
              <select
                className="input"
                value={transform}
                onChange={(e) => setTransform(e.target.value as Transform)}
              >
                <option value="none">No transformation (default)</option>
                <option value="log2">Log₂ transform (requires positive values)</option>
                <option value="log10">Log₁₀ transform (requires positive values)</option>
              </select>
              {(transform === "log2" || transform === "log10") && (
                <label className="checkbox" style={{ marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={allowNonPositiveLog}
                    onChange={(e) => setAllowNonPositiveLog(e.target.checked)}
                  />
                  I confirm the log transform; zero/negative values will be excluded or adjusted.
                </label>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Units (required)</div>
              <input
                className="input"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="e.g., ng/mL or unitless"
              />
              {!units.trim() && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>Enter units or type &quot;unitless&quot;.</div>}
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Variance convention</div>
              <div className="radio-group">
                <label className="radio">
                  <input
                    type="radio"
                    name="var-conv"
                    checked={varianceConvention === "sample"}
                    onChange={() => setVarianceConvention("sample")}
                  />
                  Sample (n−1) — default for SD/variance
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="var-conv"
                    checked={varianceConvention === "population"}
                    onChange={() => setVarianceConvention("population")}
                  />
                  Population (n)
                </label>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Outlier fence (IQR multiplier)</div>
              <div className="radio-group">
                <label className="radio">
                  <input
                    type="radio"
                    name="iqr-mult"
                    checked={iqrMultiplier === 1.5}
                    onChange={() => setIqrMultiplier(1.5)}
                  />
                  1.5× IQR (default)
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="iqr-mult"
                    checked={iqrMultiplier === 3}
                    onChange={() => setIqrMultiplier(3)}
                  />
                  3× IQR (conservative)
                </label>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="label">Publication formatting</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <div>
                  <div className="helper" style={{ marginBottom: 4 }}>Significant figures</div>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={formatOptions.sigFigs}
                    onChange={(e) => {
                      const v = Number(e.target.value) || defaultFormat.sigFigs;
                      setFormatOptions((prev) => ({ ...prev, sigFigs: Math.min(Math.max(1, v), 6) }));
                    }}
                    style={numberInputStyle}
                  />
                </div>
                <div>
                  <div className="helper" style={{ marginBottom: 4 }}>Decimal places (optional override)</div>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={formatOptions.decimalPlaces ?? ""}
                    placeholder="Auto"
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormatOptions((prev) => ({
                        ...prev,
                        decimalPlaces: val === "" ? null : Math.min(Math.max(0, Number(val) || 0), 6),
                      }));
                    }}
                    style={numberInputStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={formatOptions.scientificNotation}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, scientificNotation: e.target.checked }))}
                    />
                    Scientific notation
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={formatOptions.thousandsSeparator}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, thousandsSeparator: e.target.checked }))}
                    />
                    Thousands separator
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={formatOptions.padTrailingZeros}
                      onChange={(e) => setFormatOptions((p) => ({ ...p, padTrailingZeros: e.target.checked }))}
                    />
                    Pad trailing zeros (if decimals set)
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="calc-card" style={{ maxWidth: 1100, marginTop: 16 }}>
        <div className="section-title">2) Validation results</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div className="label">Usable rows</div>
            <div style={{ fontSize: 13, color: "#374151" }}>
              {usable.length} row(s) retained • {removed.length} removed due to missing/invalid values.
            </div>
            <div className="table" style={{ maxHeight: 220, overflow: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ textAlign: "left", padding: 6 }}>Group</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Bio rep</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Tech rep</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Value</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {usable.slice(0, 40).map((row) => (
                    <tr key={row.rowId} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 6 }}>{row.group}</td>
                      <td style={{ padding: 6 }}>{row.bioRep || "—"}</td>
                      <td style={{ padding: 6 }}>{row.techRep || "—"}</td>
                      <td style={{ padding: 6 }}>{row.value}</td>
                      <td style={{ padding: 6 }}>{row.unit || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usable.length > 40 && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Showing first 40 rows.</div>}
            </div>
          </div>
          <div className="panel" style={{ border: "1px solid #f97316", borderRadius: 12, padding: 12, background: "#fff7ed" }}>
            <div className="label" style={{ color: "#c2410c" }}>Removed / flagged</div>
            {removed.length === 0 ? (
              <div style={{ color: "#166534", fontWeight: 600 }}>No rows removed.</div>
            ) : (
              <ul style={{ marginTop: 6, paddingLeft: 16, fontSize: 13 }}>
                {removed.slice(0, 20).map((r) => (
                  <li key={r.rowId}>
                    Row {r.rowId + 1}: {r.issues.join("; ")}
                  </li>
                ))}
              </ul>
            )}
            {removed.length > 20 && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Showing first 20 removed rows.</div>}
          </div>
        </div>

        <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div className="label">n-integrity</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 8 }}>
            <StatRow label="Biological replicates (n_bio)" value={`${nBioTotal}`} />
            <StatRow label="Technical replicates (rows with tech_rep)" value={`${nTechTotal}`} />
            <StatRow label="Avg technical per biological" value={format(avgTechPerBio, 2)} />
            <StatRow
              label="Replicate handling"
              value={
                replicateType === "technical"
                  ? technicalHandling === "average"
                    ? "Technical averaged within bio"
                    : "Technical shown separately (n_bio defines SEM/CI)"
                  : "Biological replicates only"
              }
            />
          </div>
          <ul style={{ marginTop: 8, paddingLeft: 16, color: "#b45309", fontSize: 13 }}>
            <li>SEM and CI always use n_bio (never technical replicate count).</li>
            {techMissingBio && <li>Technical replicates detected without bio_rep; assign bio_rep to ensure correct n_bio.</li>}
            {replicateType === "technical" && technicalHandling === "separate" && <li>When technical replicates are shown separately, variability summaries still rely on n_bio.</li>}
            {mixedUnits && <li>Multiple units detected in data; normalize to a single unit. Global units field will be used for exports.</li>}
            {!units.trim() && <li>Please enter units or &quot;unitless&quot; before exporting figures or bundles.</li>}
          </ul>
        </div>
      </section>

      <section className="calc-card" style={{ maxWidth: 1100, marginTop: 16 }}>
        <div className="section-title">3) Descriptive statistics</div>
        {stats.length === 0 ? (
          <div className="empty">Add data and ensure replicate declaration to compute stats.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {stats.map((g) => (
              <div key={g.group} className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{g.group}</div>
                  <div className="pill" style={{ background: "#eef2ff", color: "#4338ca", fontWeight: 700 }}>
                    n (bio) = {g.nBio}
                  </div>
                </div>
                <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                  <StatRow label="Mean" value={format(g.mean)} />
                  <StatRow label="Median" value={format(g.median)} />
                  {showModes && <StatRow label="Mode(s)" value={g.modes.length ? g.modes.map((m) => format(m)).join(", ") : "—"} />}
                  <StatRow label="SD" value={format(g.sd)} tooltip={`Standard deviation (${varianceConvention === "sample" ? "sample" : "population"})`} />
                  <StatRow label="Variance" value={format(g.variance)} />
                  <StatRow label="SEM" value={format(g.sem)} tooltip="Standard error of the mean (SD/√n_bio)" />
                  <StatRow label="CV%" value={format(g.cv)} tooltip="Coefficient of variation" />
                  <StatRow label="Min" value={format(g.min)} />
                  <StatRow label="Max" value={format(g.max)} />
                  <StatRow label="Range" value={format(g.range)} />
                  <StatRow
                    label="Normality hint (approx)"
                    value={g.normality.w ? `${g.normality.label} · W=${format(g.normality.w)}` : "Not reliable (n<3)"}
                    tooltip="Heuristic; not inferential."
                  />
                  <StatRow
                    label="IQR outliers"
                    value={g.iqrFlags.count === 0 ? "0 flagged" : `${g.iqrFlags.count} flagged (never removed)`}
                    tooltip={`Outliers flagged using ${g.iqrMultiplier}×IQR fences; not removed`}
                  />
                  {g.ci95 && (
                    <StatRow
                      label="95% CI (t-based)"
                      value={`${format(g.ci95.low)} to ${format(g.ci95.high)} (df=${g.ci95.df})`}
                      tooltip="t-based CI: mean ± t*SEM"
                    />
                  )}
                </div>
                {!showModes && g.modes.length > 1 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                    Multiple modes detected; toggle below to display.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <label className="checkbox">
            <input type="checkbox" checked={showModes} onChange={(e) => setShowModes(e.target.checked)} />
            Show mode(s) when multimodal (hidden by default)
          </label>
        </div>
      </section>

      {stats.length > 0 && (
        <section className="calc-card" style={{ maxWidth: 1100, marginTop: 16 }}>
          <div className="section-title">4) Derived metrics</div>
          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div className="label">Reference group</div>
              <select className="input" value={safeReferenceGroup} onChange={(e) => setReferenceGroup(e.target.value)}>
                {stats.map((g) => (
                  <option key={g.group} value={g.group}>
                    {g.group}
                  </option>
                ))}
              </select>
              {(transform === "log2" || transform === "log10") && (
                <span className="pill" style={{ background: "#fef9c3", color: "#92400e" }}>
                  Fold-change shown on original scale; log transform applied to summaries.
                </span>
              )}
            </div>
            {foldChanges.length === 0 ? (
              <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>Add at least one non-reference group to view fold changes.</div>
            ) : (
              <div className="table" style={{ marginTop: 10, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ textAlign: "left", padding: 6 }}>Group</th>
                      <th style={{ textAlign: "left", padding: 6 }}>% change vs {safeReferenceGroup}</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Fold change</th>
                      <th style={{ textAlign: "left", padding: 6 }}>Log₂ fold change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foldChanges.map((fc) => (
                      <tr key={fc.group} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ padding: 6 }}>{fc.group}</td>
                        <td style={{ padding: 6 }}>{format(fc.percentChange, 2)}%</td>
                        <td style={{ padding: 6 }}>{format(fc.foldChange)}</td>
                        <td style={{ padding: 6 }}>{fc.log2FoldChange === null ? "—" : format(fc.log2FoldChange)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {stats.length > 0 && (
        <section className="calc-card" style={{ maxWidth: 1100, marginTop: 16 }}>
          <div className="section-title">5) Visualization preview (300 dpi-ready exports)</div>
          <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
            Normality hint is heuristic; QQ plot is for visual assessment, not an inferential test.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <label className="checkbox">
              <input type="checkbox" checked={showQq} onChange={(e) => setShowQq(e.target.checked)} /> Show QQ plot (approx)
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Histogram (raw distribution)</div>
              <div ref={histogramRef}>
                <HistogramPreview stats={stats} format={format} unitsLabel={units.trim() || "specify units"} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <button className="ghost-button" onClick={() => exportFigure(histogramRef, "histogram.png", "png")}>
                  Export PNG (≈300 dpi)
                </button>
                <button className="ghost-button" onClick={() => exportFigure(histogramRef, "histogram.svg", "svg")}>
                  Export SVG
                </button>
              </div>
              <div className="helper" style={{ marginTop: 6 }}>Axis labels + units are required before export.</div>
            </div>
            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Box & whisker</div>
              <div ref={boxRef}>
                <BoxWhisker stats={stats} format={format} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <button className="ghost-button" onClick={() => exportFigure(boxRef, "boxplot.png", "png")}>
                  Export PNG (≈300 dpi)
                </button>
                <button className="ghost-button" onClick={() => exportFigure(boxRef, "boxplot.svg", "svg")}>
                  Export SVG
                </button>
              </div>
              <div className="helper" style={{ marginTop: 6 }}>IQR-based; outliers flagged but never removed.</div>
            </div>
            <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Error bar preview</div>
              <div ref={errorRef}>
                <ErrorBarPreview stats={stats} format={format} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <button className="ghost-button" onClick={() => exportFigure(errorRef, "error-bars.png", "png")}>
                  Export PNG (≈300 dpi)
                </button>
                <button className="ghost-button" onClick={() => exportFigure(errorRef, "error-bars.svg", "svg")}>
                  Export SVG
                </button>
              </div>
              <div className="helper" style={{ marginTop: 6 }}>Mean ± SD (default); toggle SEM/95% CI manually as needed.</div>
            </div>
            {showQq && (
              <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>QQ plot (approx)</div>
                <QqPlot stats={stats} />
                <div className="helper" style={{ marginTop: 6 }}>Visual check only; not an inferential test.</div>
              </div>
            )}
          </div>
        </section>
      )}

      {stats.length > 0 && (
        <section className="calc-card" style={{ maxWidth: 1100, marginTop: 16 }}>
          <div className="section-title">6) Reporting text (copy-ready)</div>
          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700 }}>Methods snippet</div>
            <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>{methodsSnippet}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="primary" onClick={() => navigator.clipboard.writeText(methodsSnippet)}>
                Copy methods
              </button>
              <button
                className="ghost-button"
                onClick={() => navigator.clipboard.writeText(`# Methods\n${methodsSnippet}`)}
              >
                Copy as markdown
              </button>
            </div>
          </div>

          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>Results snippet (descriptive only)</div>
            <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5 }}>{resultsSnippet}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="primary" onClick={() => navigator.clipboard.writeText(resultsSnippet)}>
                Copy results
              </button>
              <button
                className="ghost-button"
                onClick={() => navigator.clipboard.writeText(`# Results\n${resultsSnippet}`)}
              >
                Copy as markdown
              </button>
            </div>
          </div>

          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>Transparency & compliance log</div>
            <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 13, lineHeight: 1.5 }}>
              {transparencyLog.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
              Descriptive only — no hypothesis testing; reviewer-friendly defaults enforced.
            </div>
          </div>

          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>Reviewer Mode (Markdown)</span>
              <button className="ghost-button" onClick={() => handleReviewerReport()} disabled={buildingReport}>
                {buildingReport ? "Building..." : "Download reviewer report"}
              </button>
            </div>
            <p style={{ marginTop: 6, fontSize: 13, color: "#374151" }}>
              One-click report: dataset summary, n-integrity, missing/transform/outlier policy, descriptive table, figure legend templates, methods/results snippets.
            </p>
          </div>

          <div className="panel" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>Export Analysis Bundle (.zip)</span>
              <button className="primary" onClick={() => handleBundleExport()} disabled={exporting}>
                {exporting ? "Building..." : "Export bundle"}
              </button>
            </div>
            <p style={{ marginTop: 6, fontSize: 13, color: "#374151" }}>
              Contains raw input, cleaned data, replicate mapping, decisions, results (CSV/JSON), methods/results markdown, figures (PNG/SVG), manifest with version/hash metadata.
            </p>
            {!units.trim() && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 6 }}>Set units (or &quot;unitless&quot;) before exporting.</div>}
          </div>
        </section>
      )}
    </main>
  );
}

type StatRowProps = { label: string; value: string; tooltip?: string };
function StatRow({ label, value, tooltip }: StatRowProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span title={tooltip}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

type VizProps = { stats: GroupStats[]; format: (n: number | null | undefined, sigOverride?: number) => string; unitsLabel?: string };
function HistogramPreview({ stats, format, unitsLabel }: VizProps) {
  const flattened = stats.flatMap((g) => g.valuesUsed.map((v) => ({ group: g.group, value: v })));
  if (flattened.length === 0) return <div className="empty">No data</div>;
  const values = flattened.map((f) => f.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(12, Math.max(6, Math.round(Math.sqrt(values.length))));
  const binSize = (max - min) / binCount || 1;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * binSize,
    end: min + (i + 1) * binSize,
    counts: {} as Record<string, number>,
  }));
  flattened.forEach((f) => {
    const idx = Math.min(binCount - 1, Math.floor((f.value - min) / binSize));
    bins[idx].counts[f.group] = (bins[idx].counts[f.group] || 0) + 1;
  });
  const labels = bins.map((b) => `${format(b.start, 2)}–${format(b.end, 2)}`);
  const groups = stats.map((s) => s.group);
  const datasets = groups.map((grp, idx) => ({
    label: grp,
    data: bins.map((b) => b.counts[grp] || 0),
    backgroundColor: palette[idx % palette.length],
    borderRadius: 4,
  }));
  const data = { labels, datasets };
  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: { title: { display: true, text: `Value (${unitsLabel})` } },
      y: { title: { display: true, text: "Count" }, beginAtZero: true, ticks: { precision: 0 } },
    },
  };
  return <Bar data={data} options={options} height={220} />;
}

function BoxWhisker({ stats, format }: VizProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {stats.map((g) => {
        const q1 = quantileSorted(g.valuesUsed, 0.25);
        const q3 = quantileSorted(g.valuesUsed, 0.75);
        const median = g.median;
        const min = g.min;
        const max = g.max;
        const iqr = q3 - q1;
        const lowerFence = q1 - g.iqrMultiplier * iqr;
        const upperFence = q3 + g.iqrMultiplier * iqr;
        const outliers = g.valuesUsed.filter((v) => v < lowerFence || v > upperFence);
        const range = max - min || 1;
        const scale = (val: number) => ((val - min) / range) * 100;
        return (
          <div key={g.group}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.group} · IQR fence = {g.iqrMultiplier}×</div>
            <div style={{ position: "relative", height: 60, borderBottom: "1px dashed #e5e7eb" }}>
              <div
                style={{
                  position: "absolute",
                  left: `${scale(min)}%`,
                  right: `${100 - scale(max)}%`,
                  height: 2,
                  background: "#cbd5e1",
                  top: 28,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${scale(q1)}%`,
                  width: `${scale(q3) - scale(q1)}%`,
                  top: 12,
                  height: 32,
                  border: "2px solid #1d4ed8",
                  background: "rgba(37, 99, 235, 0.08)",
                  borderRadius: 6,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${scale(median)}%`,
                  top: 12,
                  height: 32,
                  width: 2,
                  background: "#1d4ed8",
                }}
              />
              {[min, max].map((v) => (
                <div
                  key={v}
                  style={{
                    position: "absolute",
                    left: `${scale(v)}%`,
                    top: 22,
                    height: 16,
                    width: 2,
                    background: "#0f172a",
                  }}
                  title={v.toString()}
                />
              ))}
              {outliers.map((v, i) => (
                <div
                  key={`${v}-${i}`}
                  style={{
                    position: "absolute",
                    left: `${scale(v)}%`,
                    top: 46,
                    height: 8,
                    width: 8,
                    borderRadius: "9999px",
                    background: "#dc2626",
                  }}
                  title={`Outlier: ${v}`}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              <span>Min {format(min, 2)}</span>
              <span>Median {format(median, 2)}</span>
              <span>Max {format(max, 2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ErrorBarPreview({ stats, format }: VizProps) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {stats.map((g) => {
        const mean = g.mean;
        const sdLow = mean - g.sd;
        const sdHigh = mean + g.sd;
        const semLow = mean - g.sem;
        const semHigh = mean + g.sem;
        const ci = g.ci95;
        const ciLow = ci ? ci.low : mean;
        const ciHigh = ci ? ci.high : mean;
        const min = Math.min(sdLow, semLow, ciLow);
        const max = Math.max(sdHigh, semHigh, ciHigh);
        const range = max - min || 1;
        const scale = (val: number) => ((val - min) / range) * 100;
        return (
          <div key={g.group}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.group}</div>
            <div style={{ position: "relative", height: 64, borderBottom: "1px dashed #e5e7eb" }}>
              <ErrorLine label="Mean ± SD" color="#1d4ed8" center={scale(mean)} low={scale(sdLow)} high={scale(sdHigh)} />
              <ErrorLine label="Mean ± SEM" color="#0ea5e9" center={scale(mean)} low={scale(semLow)} high={scale(semHigh)} offset={16} />
              <ErrorLine label="Mean ± 95% CI (t)" color="#f97316" center={scale(mean)} low={scale(ciLow)} high={scale(ciHigh)} offset={32} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              <span>Mean {format(mean, 2)}</span>
              <span>n_bio = {g.nBio}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ErrorLineProps = { label: string; color: string; low: number; high: number; center: number; offset?: number };
function ErrorLine({ label, color, low, high, center, offset = 0 }: ErrorLineProps) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: offset }}>
      <div style={{ position: "absolute", left: `${low}%`, right: `${100 - high}%`, height: 2, background: color }} />
      <div style={{ position: "absolute", left: `${center}%`, width: 2, height: 14, background: color, top: -4 }} />
      <div style={{ position: "absolute", left: `${low}%`, width: 2, height: 10, background: color, top: -2 }} />
      <div style={{ position: "absolute", left: `${high}%`, width: 2, height: 10, background: color, top: -2 }} />
      <span style={{ position: "absolute", left: 0, top: 10, fontSize: 11, color: "#4b5563" }}>{label}</span>
    </div>
  );
}

const palette = ["#1d4ed8", "#10b981", "#f97316", "#9333ea", "#ef4444", "#0ea5e9", "#f59e0b"];
