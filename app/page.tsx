import Link from "next/link";

export default function Home() {
  return (
    <main className="calc-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 0" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 32, letterSpacing: "-0.02em" }}>LabHelpr</h1>
        <p style={{ marginTop: 6, color: "#4b5563" }}>Tools for wet-lab calculations and descriptive statistics.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Link href="/calculator" style={{ textDecoration: "none" }}>
          <div
            className="calc-card"
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
              background: "white",
              transition: "box-shadow 0.2s ease, transform 0.2s ease",
            }}
          >
            <div style={{ fontSize: 14, color: "#2563eb", fontWeight: 700, marginBottom: 6 }}>Calculator</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Lab calculators</div>
            <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Unit conversion, dilution, molarity, centrifuge RCF/RPM, PCR mastermix, OD600, molecular weight, cell seeding, and more.
            </div>
          </div>
        </Link>

        <Link href="/statistical-analysis" style={{ textDecoration: "none" }}>
          <div
            className="calc-card"
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
              background: "white",
              transition: "box-shadow 0.2s ease, transform 0.2s ease",
            }}
          >
            <div style={{ fontSize: 14, color: "#2563eb", fontWeight: 700, marginBottom: 6 }}>Statistical Analysis</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Descriptive statistics</div>
            <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Replicate-aware descriptive statistics for wet-lab data with missingness, outlier flags, and export/report options.
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
