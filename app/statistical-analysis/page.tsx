"use client";

import Link from "next/link";

export default function StatisticalAnalysisPage() {
  return (
    <main className="calc-page" style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 32 }}>
      <header className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="badge" style={{ marginBottom: 8 }}>Statistical Analysis</div>
            <h1 style={{ margin: 0 }}>Statistical Analysis</h1>
            <p style={{ marginTop: 6, color: "#4b5563", maxWidth: 820 }}>
              Wet-lab oriented stats tools. Biological replicates are the reporting unit; technical replicates are never treated as independent n.
            </p>
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, color: "#4b5563", fontSize: 14, lineHeight: 1.6 }}>
              <li>Descriptive-only outputs (no significance wording). Missing values/outliers are surfaced, not silently dropped.</li>
              <li>Designed for PhD students and wet-lab researchers preparing figures/reports.</li>
            </ul>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="ghost-button" href="/">Home</Link>
            <Link className="ghost-button" href="/calculator">Go to calculators</Link>
          </div>
        </div>
      </header>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div className="section-title">Available tools</div>
        <div style={{ color: "#4b5563", fontSize: 14, marginBottom: 8 }}>Pick a tool to start. More analysis modules can be added here over time.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: 8 }}>
          <Link href="/descriptive-stats" style={{ textDecoration: "none" }}>
            <div className="calc-card" style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "white" }}>
              <div className="badge" style={{ marginBottom: 6 }}>Descriptive Statistics</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Replicate-aware summaries (descriptive-only)</div>
              <div style={{ color: "#4b5563", lineHeight: 1.6 }}>
                Upload/paste tabular experimental data, map columns, declare biological/technical replicates, set control group, and export publication-ready summaries with missingness and outlier flags.
              </div>
              <ul style={{ margin: "10px 0 0 0", paddingLeft: 18, color: "#4b5563", fontSize: 13, lineHeight: 1.6 }}>
                <li>Accepted: CSV/TSV/Excel plate/wide/long; replicate-aware ingestion.</li>
                <li>Outputs: summary tables, histograms/strip/QQ/bio-vs-tech plots, missingness, control comparisons, exports (CSV/JSON/PDF/Excel).</li>
                <li>Scope: descriptive statistics only; no p-values or significance language.</li>
              </ul>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
