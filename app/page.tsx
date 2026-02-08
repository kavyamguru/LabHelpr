import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="calc-page">
      <header className="calc-card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Image src="/logo-labhelpr-mark.svg" alt="LabHelpr" width={56} height={56} priority />
        <div>
          <h1 style={{ margin: 0 }}>LabHelpr</h1>
          <p style={{ marginTop: 6 }}>Wet-lab tools for life science researchers.</p>
        </div>
      </header>

      <section className="calc-card" style={{ marginTop: 16 }}>
        <Image
          src="/logo-labhelpr.svg"
          alt="LabHelpr logo"
          width={720}
          height={180}
          style={{ width: "100%", height: "auto" }}
        />
      </section>

      <section className="calc-grid" style={{ marginTop: 16 }}>
        <Link href="/calculator" className="calc-card" style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 700 }}>Open Calculator Suite</div>
          <p style={{ marginTop: 6 }}>Core wet-lab calculators for daily bench work.</p>
        </Link>
        <Link href="/projects" className="calc-card" style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 700 }}>Manage Projects</div>
          <p style={{ marginTop: 6 }}>Track and organize your research projects.</p>
        </Link>
      </section>

      <section className="calc-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Logo Variants</div>
        <div style={{ display: "grid", gap: 12 }}>
          <Image src="/logo-labhelpr-minimal.svg" alt="LabHelpr Minimal" width={520} height={110} style={{ width: "100%", height: "auto" }} />
          <Image src="/logo-labhelpr-premium.svg" alt="LabHelpr Premium" width={520} height={110} style={{ width: "100%", height: "auto" }} />
          <Image src="/logo-labhelpr-bold.svg" alt="LabHelpr Bold" width={520} height={110} style={{ width: "100%", height: "auto" }} />
        </div>
      </section>
    </main>
  );
}
