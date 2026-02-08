import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="calc-page" style={{ minHeight: "100vh" }}>
      <header className="calc-card" style={{ maxWidth: 900 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="brand-mark-wrap" aria-label="LabHelpr mark">
            <Image
              src="/labhelpr-logo.png"
              alt="LabHelpr logo mark"
              width={1024}
              height={1024}
              priority
              className="brand-mark"
            />
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>LabHelpr</div>
        </div>
      </header>

      <section className="calc-card" style={{ marginTop: 16, maxWidth: 900 }}>
        <Link href="/calculator" className="calc-launch" style={{ textDecoration: "none" }}>
          <div className="calc-launch-box" aria-hidden="true">
            <Image
              src="/calculator-icon.png"
              alt="Calculator"
              width={512}
              height={512}
              quality={100}
              className="calc-launch-icon"
            />
          </div>
          <div className="calc-launch-text">LH Calculator</div>
        </Link>
      </section>
    </main>
  );
}
