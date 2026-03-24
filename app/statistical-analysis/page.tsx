"use client";

import Link from "next/link";

export default function StatisticalAnalysisPage() {
  return (
    <main className="calc-page" style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 32 }}>
      <header className="calc-card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div className="badge" style={{ marginBottom: 8 }}>Statistical Analysis</div>
            <h1 style={{ margin: 0 }}>Statistical Analysis</h1>
            <p style={{ marginTop: 6, color: "#4b5563" }}>Replicate-aware analysis tools for wet-lab data.</p>
          </div>
          <Link className="ghost-button" href="/calculator">Go to calculators</Link>
        </div>
      </header>

      <section className="calc-card" style={{ marginBottom: 12 }}>
        <div className="section-title">Available tools</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: 8 }}>
          <Link href="/descriptive-stats" style={{ textDecoration: "none" }}>
            <div className="calc-card" style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "white" }}>
              <div className="badge" style={{ marginBottom: 6 }}>Descriptive Statistics</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Replicate-aware summaries</div>
              <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                Upload/paste data, map columns, declare replicates, and export publication-ready descriptive stats with missingness and outlier flags.
              </div>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
