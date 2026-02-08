import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="calc-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <Link
        href="/calculator"
        className="calc-card"
        style={{
          textDecoration: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 24,
          minWidth: 260,
        }}
      >
        <Image src="/logo-labhelpr-mark.svg" alt="LH" width={80} height={80} priority />
        <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "0.02em" }}>LH Calculator</div>
      </Link>
    </main>
  );
}
