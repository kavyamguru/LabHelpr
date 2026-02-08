import Link from "next/link";

export default function Home() {
  return (
    <main className="calc-page" style={{ minHeight: "100vh" }}>
      <header
        className="calc-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: 520,
        }}
      >
        <div
          aria-label="LH logo"
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            letterSpacing: "0.02em",
            fontSize: 22,
            color: "#ffffff",
            background: "linear-gradient(135deg, #0f172a 0%, #0f766e 100%)",
            flexShrink: 0,
          }}
        >
          LH
        </div>

        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>LabHelpr</div>
        </div>
      </header>

      <section className="calc-card" style={{ marginTop: 16, maxWidth: 520 }}>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 10 }}>LH Calculator</div>
        <Link
          href="/calculator"
          style={{
            display: "inline-block",
            textDecoration: "none",
            fontWeight: 700,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #9cc3ea",
            background: "#ffffff",
            color: "#0f2742",
          }}
        >
          Open LH Calculator
        </Link>
      </section>
    </main>
  );
}
