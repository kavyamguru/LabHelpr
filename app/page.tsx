import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="calc-page" style={{ minHeight: "100vh" }}>
      <header className="calc-card" style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Image
            src="/labhelpr-logo.png"
            alt="LabHelpr logo"
            width={64}
            height={64}
            priority
            style={{ borderRadius: 12 }}
          />
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: "#1f2937" }}>
            LabHelpr
          </div>
        </div>
      </header>

      <section className="calc-card" style={{ marginTop: 16, maxWidth: 900 }}>
        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 12, color: "#14532d" }}>LH Calculator</div>
        <p style={{ marginTop: 0, marginBottom: 14, opacity: 0.85 }}>
          Open the complete calculator suite for day-to-day lab workflows.
        </p>
        <Link href="/calculator" className="btn-primary" style={{ textDecoration: "none" }}>
          Open LH Calculator
        </Link>
      </section>
    </main>
  );
}
