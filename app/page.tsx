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
            <svg viewBox="0 0 64 64" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="12" y="8" width="40" height="48" rx="8" stroke="currentColor" strokeWidth="3" />
              <rect x="20" y="14" width="24" height="8" rx="2" fill="currentColor" opacity="0.2" />
              <circle cx="22" cy="30" r="2.5" fill="currentColor" />
              <circle cx="32" cy="30" r="2.5" fill="currentColor" />
              <circle cx="42" cy="30" r="2.5" fill="currentColor" />
              <circle cx="22" cy="39" r="2.5" fill="currentColor" />
              <circle cx="32" cy="39" r="2.5" fill="currentColor" />
              <circle cx="42" cy="39" r="2.5" fill="currentColor" />
              <rect x="20" y="46" width="24" height="6" rx="2" fill="currentColor" opacity="0.85" />
            </svg>
          </div>
          <div className="calc-launch-text">LH Calculator</div>
        </Link>
      </section>
    </main>
  );
}
