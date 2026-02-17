"use client";

export default function StatisticalAnalysisReset() {
  return (
    <main className="calc-page" style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <header className="calc-card" style={{ marginBottom: 16 }}>
        <div className="badge" style={{ marginBottom: 8 }}>Reset</div>
        <h1 style={{ margin: 0 }}>Statistical Analysis</h1>
        <p style={{ marginTop: 6 }}>
          This page has been reset and will be rebuilt. If you need the previous functionality, refer to git history
          or ask for a specific feature to reintroduce first.
        </p>
      </header>
      <section className="calc-card">
        <h2 style={{ marginTop: 0 }}>Status</h2>
        <p>All prior statistical analysis UI and charts have been removed. No calculations or uploads are currently active.</p>
        <p style={{ color: "#b91c1c" }}>Next steps: define the initial feature set to rebuild (e.g., sample data ingestion, basic plots, exports) and add them incrementally.</p>
      </section>
    </main>
  );
}
