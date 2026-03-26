"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { Upload } from "../components/Upload";
import { DataPreview } from "../components/DataPreview";
import { StatSummary } from "../components/StatSummary";
import { Visualizations } from "../components/Visualizations";
import { ExportPanel } from "../components/ExportPanel";

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
  const normalized = input.replace(/\t/g, ",");
  const parsed = Papa.parse<string[]>(normalized.trim(), {
    delimiter: ",",
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
  const [missingHandling, _setMissingHandling] = useState<MissingHandling>("ignore");
  const [replicateType, _setReplicateType] = useState<ReplicateType>("biological");
  const [technicalHandling, _setTechnicalHandling] = useState<TechnicalHandling>("average");
  const [transform, _setTransform] = useState<Transform>("none");
  const [allowNonPositiveLog, _setAllowNonPositiveLog] = useState(false);
  const [referenceGroup, _setReferenceGroup] = useState<string>("Control");
  const [units, _setUnits] = useState<string>("unitless");
  const [showModes, setShowModes] = useState(false);
  const [varianceConvention, _setVarianceConvention] = useState<VarianceConvention>("sample");
  const [iqrMultiplier, _setIqrMultiplier] = useState<number>(1.5);
  const [formatOptions, _setFormatOptions] = useState(defaultFormat);
  const [showQq, setShowQq] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [buildingReport, setBuildingReport] = useState(false);

  const histogramRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const exportFigure = useCallback(async (ref: { current: HTMLDivElement | null }, filename: string, format: "png" | "svg") => {
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
    }, [units]);

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
  const _techMissingBio = useMemo(
    () =>
      replicateType === "technical" &&
      usable.some((u) => u.techRep && !u.bioRep),
    [replicateType, usable]
  );
  const unitsFromData = useMemo(() => {
    const set = new Set(usable.map((u) => (u.unit || "").trim()).filter(Boolean));
    return set;
  }, [usable]);
  const _mixedUnits = unitsFromData.size > 1;

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

      await addText("raw_input.csv", rawInput);

      const cleanedCsv = ["group,bio_rep,tech_rep,value,unit"].concat(
        usable.map((r) => `${r.group ?? ""},${r.bioRep ?? ""},${r.techRep ?? ""},${r.value ?? ""},${r.unit ?? ""}`)
      );
      await addText("cleaned_data.csv", cleanedCsv.join("\n"));

      const replicateMap = usable.map((r) => ({ group: r.group, bio_rep: r.bioRep, tech_rep: r.techRep, value: r.value, unit: r.unit }));
      await addText("replicate_mapping.json", JSON.stringify(replicateMap, null, 2));

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
      await addText("decisions.json", JSON.stringify(decisions, null, 2));

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
      await addText("results.json", JSON.stringify(resultsJson, null, 2));

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
      await addText("results.csv", resultsCsv.join("\n"));

      await addText("methods.md", `# Methods\n${methodsSnippet}\n`);
      await addText("results.md", `# Results\n${resultsSnippet}\n`);

      const pngSvg = async (ref: React.RefObject<HTMLDivElement | null>, name: string) => {
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
      await addText("manifest.json", JSON.stringify(manifest, null, 2));

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

  const _inputClass = "w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:ring-blue-500/50";
  const _labelClass = "text-sm font-semibold text-slate-800 dark:text-slate-100";
  const _helperClass = "text-xs text-slate-500 dark:text-slate-400";

  const vizItems = useMemo(
    () => [
      {
        key: "histogram",
        label: "Histogram",
        refElement: histogramRef,
        exportName: "histogram",
        content: <HistogramPreview stats={stats} format={format} unitsLabel={units.trim() || "specify units"} />,
      },
      {
        key: "box",
        label: "Box & whisker",
        refElement: boxRef,
        exportName: "boxplot",
        content: <BoxWhisker stats={stats} format={format} />,
      },
      {
        key: "error",
        label: "Error bars",
        refElement: errorRef,
        exportName: "error-bars",
        content: <ErrorBarPreview stats={stats} format={format} />,
      },
      {
        key: "qq",
        label: "QQ plot (approx)",
        content: <QqPlot stats={stats} />,
      },
    ],
    [boxRef, errorRef, format, histogramRef, stats, units]
  );

  const summarySentence = useMemo(() => {
    if (foldChanges.length > 0) {
      const fc = foldChanges[0];
      const direction = fc.percentChange && fc.percentChange > 0 ? "higher" : "lower";
      const pct = fc.percentChange ? Math.abs(fc.percentChange) : null;
      return `${fc.group} is ${direction} than ${safeReferenceGroup}${pct !== null ? ` (+${format(pct, 2)}%)` : ""}`;
    }
    if (stats.length >= 2) {
      const ref = stats[0];
      const other = stats[1];
      const pct = ref.mean ? ((other.mean - ref.mean) / ref.mean) * 100 : 0;
      const direction = pct > 0 ? "higher" : "lower";
      return `${other.group} is ${direction} than ${ref.group} (+${format(Math.abs(pct), 2)}%)`;
    }
    return "Results ready";
  }, [foldChanges, safeReferenceGroup, stats, format]);

  const variabilitySentence = useMemo(() => {
    const cvs = stats.map((g) => g.cv).filter((v) => Number.isFinite(v));
    if (!cvs.length) return "Variability: n/a";
    const avg = cvs.reduce((a, b) => a + b, 0) / cvs.length;
    const label = avg < 15 ? "low" : avg < 30 ? "moderate" : "high";
    return `Variability: ${label} (CV ${format(avg, 2)}%)`;
  }, [stats, format]);

  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showDataInput, setShowDataInput] = useState(false);
  const [showDescriptive, setShowDescriptive] = useState(false);

  const accordionSections = useMemo(
    () => [
      {
        key: "stats",
        label: "View detailed statistics",
        render: () => (
          <StatSummary stats={stats} showModes={showModes} onToggleModes={(checked) => setShowModes(checked)} format={format} varianceConvention={varianceConvention} />
        ),
      },
      {
        key: "quality",
        label: "View data quality",
        render: () => (
          <div className="space-y-3">
            <DataPreview usable={usable} removed={removed} />
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-200 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">n_bio: {nBioTotal}</div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">tech rows: {nTechTotal}</div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">avg tech/bio: {format(avgTechPerBio, 2)}</div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">units: {units.trim() || "unitless"}</div>
            </div>
          </div>
        ),
      },
      {
        key: "plots",
        label: "View plots",
        render: () => (
          <Visualizations items={vizItems} showQq={showQq} onToggleQq={(checked) => setShowQq(checked)} onExportFigure={exportFigure} helper="Toggle to see additional plots." />
        ),
      },
      {
        key: "methods",
        label: "View methods & reporting",
        render: () => (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-sm font-semibold text-slate-100">Methods</div>
              <p className="text-sm text-slate-300">{methodsSnippet}</p>
              <div className="mt-2 flex gap-2">
                <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900" onClick={() => navigator.clipboard.writeText(methodsSnippet)}>
                  Copy
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-sm font-semibold text-slate-100">Results</div>
              <p className="text-sm text-slate-300">{resultsSnippet}</p>
              <div className="mt-2 flex gap-2">
                <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900" onClick={() => navigator.clipboard.writeText(resultsSnippet)}>
                  Copy
                </button>
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "export",
        label: "Export results",
        render: () => (
          <ExportPanel onReviewerReport={handleReviewerReport} onBundleExport={handleBundleExport} buildingReport={buildingReport} exporting={exporting} units={units} />
        ),
      },
    ],
    [avgTechPerBio, buildingReport, exporting, handleBundleExport, handleReviewerReport, methodsSnippet, resultsSnippet, showModes, format, nBioTotal, nTechTotal, stats, units, showQq, vizItems, exportFigure, usable, removed, varianceConvention]
  );

  const toggleSection = (key: string) => {
    setOpenSection((prev) => (prev === key ? null : key));
  };

  const defaultPlot = (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner">
      <div className="mb-3 text-sm font-semibold text-slate-200">Distribution</div>
      <div ref={boxRef as React.RefObject<HTMLDivElement>}>
        <BoxWhisker stats={stats} format={format} />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b1525] via-[#0c1b2f] to-[#0b1525] pb-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {!showDescriptive && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-emerald-300">Descriptive analysis</div>
                <p className="text-sm text-slate-300">Open the results-first view.</p>
              </div>
              <button className="rounded-full bg-emerald-500 px-3 py-2 text-sm font-semibold text-white" onClick={() => setShowDescriptive(true)}>
                Open descriptive analysis
              </button>
            </div>
          </div>
        )}

        {showDescriptive && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-slate-50">Statistical Analysis</h1>
                <p className="text-sm text-slate-300">Minimal, results-first view. Details on click.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-100" onClick={() => setShowDataInput((v) => !v)}>
                  {showDataInput ? "Hide data input" : "Change data"}
                </button>
                <button className="rounded-full border border-emerald-600 bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white" onClick={() => setRawInput(defaultTemplate)}>
                  Load sample data
                </button>
                <button className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-100" onClick={() => setShowDescriptive(false)}>
                  Close
                </button>
              </div>
            </div>

            {showDataInput && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <Upload
                  rawInput={rawInput}
                  onRawInputChange={setRawInput}
                  onLoadTemplate={() => setRawInput(defaultTemplate)}
                  label="Paste or upload data"
                  helper="CSV / Excel"
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
                  <div className="text-base font-semibold text-slate-50">{summarySentence}</div>
                  <div className="text-sm text-slate-300">{variabilitySentence}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {stats.map((g) => (
                      <div key={g.group} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100">
                        <div className="font-semibold">{g.group}</div>
                        <div className="flex gap-3 text-slate-300">
                          <span>mean {format(g.mean)}</span>
                          <span>n {g.nBio}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {defaultPlot}
            </div>

            <div className="space-y-3">
              {accordionSections.map((section) => (
                <div key={section.key} className="rounded-2xl border border-slate-800 bg-slate-900/70">
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-100"
                    onClick={() => toggleSection(section.key)}
                  >
                    {section.label}
                    <span className="text-xs text-slate-400">{openSection === section.key ? "Hide" : "Show"}</span>
                  </button>
                  {openSection === section.key && <div className="border-t border-slate-800 p-4">{section.render()}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
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
