import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="calc-page" style={{ minHeight: "100vh" }}>
      <header className="calc-card" style={{ maxWidth: 880, padding: 22 }}>
        <Image
          src="/logo-labhelpr-pro.svg"
          alt="LabHelpr"
          width={1000}
          height={230}
          priority
          style={{ width: "100%", height: "auto" }}
        />
      </header>

      <section className="calc-card" style={{ marginTop: 16, maxWidth: 880 }}>
        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 12 }}>LH Calculator</div>
        <p style={{ marginTop: 0, marginBottom: 14, opacity: 0.85 }}>
          Open the complete calculator suite for dilution, molarity, centrifuge, PCR mix, OD600 and more.
        </p>
        <Link href="/calculator" className="btn-primary" style={{ textDecoration: "none" }}>
          Open LH Calculator
        </Link>
      </section>
    </main>
  );
}
