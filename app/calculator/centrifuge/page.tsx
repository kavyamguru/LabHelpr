"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

function fmt(x: number, maxFrac = 2) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

type RadiusUnit = "cm" | "mm";
const RADIUS_TO_CM: Record<RadiusUnit, number> = { cm: 1, mm: 0.1 };

export default function CentrifugePage() {
  const [mode, setMode] = useState<"rpm-to-rcf" | "rcf-to-rpm">("rpm-to-rcf");
  const [radius, setRadius] = useState(10); // default 10 cm
  const [radiusUnit, setRadiusUnit] = useState<RadiusUnit>("cm");
  const [rpm, setRpm] = useState(12000);
  const [rcf, setRcf] = useState(10000);

  const hasInvalid = radius <= 0 || (mode === "rpm-to-rcf" ? rpm < 0 : rcf < 0);

  const result = useMemo(() => {
    const rCm = (Number(radius) || 0) * RADIUS_TO_CM[radiusUnit];

    // constant in formula
    const k = 1.118e-5;

    if (mode === "rpm-to-rcf") {
      const RPM = Number(rpm) || 0;
      const RCF = k * rCm * RPM * RPM;
      return { RCF };
    } else {
      const RCF = Number(rcf) || 0;
      const RPM = rCm <= 0 ? 0 : Math.sqrt(RCF / (k * rCm));
      return { RPM };
    }
  }, [mode, radius, radiusUnit, rpm, rcf]);

  return (
    <main className="calc-page">
      <h1>Centrifuge Calculator</h1>
      <p style={{ opacity: 0.8 }}>
        Convert between <strong>RPM</strong> and <strong>RCF (×g)</strong> using rotor radius.
      </p>

      <div style={{ marginTop: 12 }}>
        <label>
          <input
            type="radio"
            checked={mode === "rpm-to-rcf"}
            onChange={() => setMode("rpm-to-rcf")}
          />{" "}
          RPM → RCF
        </label>
        <br />
        <label>
          <input
            type="radio"
            checked={mode === "rcf-to-rpm"}
            onChange={() => setMode("rcf-to-rpm")}
          />{" "}
          RCF → RPM
        </label>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 160 }}>Rotor radius</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            style={{ padding: 8, width: 140 }}
          />
          <select value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value as RadiusUnit)}>
            <option value="cm">cm</option>
            <option value="mm">mm</option>
          </select>
        </div>

        {mode === "rpm-to-rcf" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ width: 160 }}>RPM</label>
            <input
              type="number"
            onFocus={(e) => e.currentTarget.select()}
              value={rpm}
              onChange={(e) => setRpm(Number(e.target.value))}
              style={{ padding: 8, width: 160 }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ width: 160 }}>RCF (×g)</label>
            <input
              type="number"
            onFocus={(e) => e.currentTarget.select()}
              value={rcf}
              onChange={(e) => setRcf(Number(e.target.value))}
              style={{ padding: 8, width: 160 }}
            />
          </div>
        )}
      </div>

      {hasInvalid ? <p style={{ color: "#475569" }}>Tip: use a positive rotor radius and non-negative RPM/RCF values.</p> : null}

      <div style={{ marginTop: 22 }}>
        {mode === "rpm-to-rcf" ? (
          <div>
            <strong>RCF:</strong> {fmt(result.RCF ?? 0, 0)} ×g
          </div>
        ) : (
          <div>
            <strong>RPM:</strong> {fmt(result.RPM ?? 0, 0)}
          </div>
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
        Formula: RCF = 1.118 × 10⁻⁵ × r(cm) × RPM²
      </p>

      <CalcActions
        copyText={
          hasInvalid
            ? undefined
            : mode === "rpm-to-rcf"
              ? `Centrifuge\nRCF: ${result.RCF} xg`
              : `Centrifuge\nRPM: ${result.RPM}`
        }
      />
    </main>
  );
}

