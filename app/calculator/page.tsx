import Image from "next/image";
import Link from "next/link";

const tools = [
  { href: "/calculator/unit-conversion", title: "Unit Conversion" },
  { href: "/calculator/dilution", title: "Dilution" },
  { href: "/calculator/molarity", title: "Molarity" },
  { href: "/calculator/centrifuge", title: "Centrifuge" },
  { href: "/calculator/pcr-mastermix", title: "PCR Mastermix" },
  { href: "/calculator/a260", title: "Nucleic Acid (A260)" },
  { href: "/calculator/serial-dilution", title: "Serial Dilution" },
  { href: "/calculator/stock-prep", title: "Stock Preparation" },
  { href: "/calculator/od600", title: "OD600" },
  { href: "/calculator/molecular-weight", title: "Molecular Weight" },
];

export default function CalculatorPage() {
  return (
    <main className="calc-page">
      <header className="calc-card" style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 900 }}>
        <div className="brand-mark-wrap" aria-label="LabHelpr mark">
          <Image
            src="/labhelpr-logo.png"
            alt="LabHelpr logo mark"
            width={1024}
            height={1024}
            className="brand-mark"
          />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.15 }}>LabHelpr</div>
          <div style={{ opacity: 0.8, fontSize: 14 }}>LH Calculator</div>
        </div>
      </header>

      <section className="calc-grid" style={{ marginTop: 16 }}>
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="calc-card" style={{ textDecoration: "none" }}>
            <div style={{ fontWeight: 700 }}>{tool.title}</div>
          </Link>
        ))}
      </section>

      <section className="calc-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Feedback</div>
        <p style={{ marginTop: 0, marginBottom: 10, fontSize: 14, opacity: 0.9 }}>
          To improve the platform for you, please fill the feedback form.
        </p>
        <a href="https://forms.office.com/r/TMKSjrwFCh" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
          Fill Feedback Form →
        </a>
      </section>
    </main>
  );
}
