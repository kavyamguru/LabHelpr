"use client";

import Link from "next/link";
import dynamicImport from "next/dynamic";

const DescriptiveStats = dynamicImport(() => import("../descriptive-stats/page.client"), { ssr: false, loading: () => <div className="calc-card" style={{ padding: 12 }}>Loading descriptive statistics…</div> });

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
        <div className="section-title">Descriptive Statistics</div>
        <p style={{ marginTop: 4, color: "#4b5563", maxWidth: 900 }}>
          Upload or paste experimental data, map columns, declare replicates, and generate publication-ready descriptive summaries with exports.
        </p>
        <div style={{ marginTop: 12 }}>
          <DescriptiveStats />
        </div>
      </section>
    </main>
  );
}
