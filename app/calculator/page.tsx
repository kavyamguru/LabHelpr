import Image from "next/image";
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
      <header className="calc-card" style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 900 }}>
        <Image src="/labhelpr-logo.png" alt="LabHelpr logo" width={44} height={44} style={{ borderRadius: 10 }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.15 }}>LabHelpr</div>
          <div style={{ opacity: 0.8, fontSize: 14 }}>LH Calculator</div>
        </div>
      </header>

      <section className="calc-grid" style={{ marginTop: 16 }}>
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="calc-card" style={{ textDecoration: "none" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{tool.title}</div>
            <div style={{ opacity: 0.8, fontSize: 14 }}>{tool.desc}</div>
          </Link>
        ))}
      </section>

      <section className="calc-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Feedback</div>
        <p style={{ marginTop: 0, marginBottom: 8, fontSize: 14, opacity: 0.9 }}>
          Help us improve LH Calculator.
        </p>
        <ol style={{ margin: "0 0 12px 18px", padding: 0, fontSize: 14, opacity: 0.9 }}>
          <li>Open the feedback form.</li>
          <li>Select the calculator you used.</li>
          <li>Describe what worked or what issue you saw.</li>
          <li>Submit your feedback.</li>
        </ol>
        <a
          href="https://forms.office.com/r/TMKSjrwFCh"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 700 }}
        >
          Open Feedback Form →
        </a>
      </section>
    </main>
  );
}
