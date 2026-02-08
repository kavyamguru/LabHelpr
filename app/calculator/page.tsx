import Link from "next/link";

const tools = [
  { href: "/calculator/unit-conversion", title: "Unit Conversion", desc: "µL ↔ mL, nM ↔ µM ↔ mM ↔ M" },
  { href: "/calculator/dilution", title: "Dilution", desc: "C1V1 = C2V2 stock and diluent volumes" },
  { href: "/calculator/molarity", title: "Molarity", desc: "grams needed or concentration from mass" },
  { href: "/calculator/centrifuge", title: "Centrifuge", desc: "RCF ↔ RPM using rotor radius" },
  { href: "/calculator/pcr-mastermix", title: "PCR Mastermix", desc: "Reaction-scale mix planning" },
  { href: "/calculator/a260", title: "A260", desc: "DNA/RNA concentration from absorbance" },
  { href: "/calculator/serial-dilution", title: "Serial Dilution", desc: "Stepwise dilution table" },
  { href: "/calculator/stock-prep", title: "Stock Preparation", desc: "Molar, %w/v and %v/v prep" },
  { href: "/calculator/od600", title: "OD600", desc: "cells/mL estimate + dilution planning" },
  { href: "/calculator/molecular-weight", title: "Molecular Weight", desc: "Formula parser with hydrate support" },
];

export default function CalculatorPage() {
  return (
    <main className="calc-page">
      <span className="badge">Calculator v1.0 • Release Candidate</span>
      <h1 style={{ marginTop: 10 }}>LabHelpr Calculator Suite</h1>
      <p style={{ marginBottom: 16, opacity: 0.85 }}>
        Fast, bench-friendly calculators with clear outputs for daily lab workflows.
      </p>

      <section className="calc-grid">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="calc-card" style={{ textDecoration: "none" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{tool.title}</div>
            <div style={{ opacity: 0.8, fontSize: 14 }}>{tool.desc}</div>
          </Link>
        ))}
      </section>

      <div className="calc-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700 }}>Feedback loop for v1</div>
        <p style={{ marginTop: 6, fontSize: 14, opacity: 0.8 }}>
          Calculator is now in release mode. Only bug fixes and UX refinements will be made based on user feedback.
        </p>
        <a href="https://forms.office.com/r/TMKSjrwFCh" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>Send calculator feedback →</a>
      </div>
    </main>
  );
}
