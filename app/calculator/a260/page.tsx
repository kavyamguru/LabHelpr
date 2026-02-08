"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type SampleType = "dsDNA" | "RNA" | "ssDNA";

const FACTOR_UG_PER_ML_PER_A260: Record<SampleType, number> = {
  dsDNA: 50, // µg/mL per A260
  RNA: 40,
  ssDNA: 33,
};

function fmt(x: number, maxFrac = 2) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export default function A260Page() {
  const [sampleType, setSampleType] = useState<SampleType>("dsDNA");
  const [a260, setA260] = useState(1.0);
  const [dilution, setDilution] = useState(1); // e.g., 10 if diluted 1:10

  const hasInvalid = a260 < 0 || dilution <= 0;

  const result = useMemo(() => {
    const A = Number(a260) || 0;
    const D = Number(dilution) || 0;
    const factor = FACTOR_UG_PER_ML_PER_A260[sampleType];

    // Concentration in µg/mL
    const ugPerMl = A * factor * D;

    // Convert: 1 µg/mL = 1 ng/µL
    const ngPerUl = ugPerMl;

    return { ugPerMl, ngPerUl, factor };
  }, [sampleType, a260, dilution]);

  return (
    <main className="calc-page">
      <h1>A260 Concentration</h1>
      <p style={{ opacity: 0.8 }}>
        Calculate nucleic acid concentration from A260 (NanoDrop/spectrophotometer).
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 180 }}>Sample type</label>
          <select
            value={sampleType}
            onChange={(e) => setSampleType(e.target.value as SampleType)}
          >
            <option value="dsDNA">dsDNA (50 µg/mL per A260)</option>
            <option value="RNA">RNA (40 µg/mL per A260)</option>
            <option value="ssDNA">ssDNA (33 µg/mL per A260)</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 180 }}>A260</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            step="0.01"
            value={a260}
            onChange={(e) => setA260(Number(e.target.value))}
            style={{ padding: 8, width: 160 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 180 }}>Dilution factor</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={dilution}
            onChange={(e) => setDilution(Number(e.target.value))}
            style={{ padding: 8, width: 160 }}
          />
          <span style={{ opacity: 0.7, fontSize: 13 }}>
            (Use 1 if undiluted; 10 if 1:10 dilution)
          </span>
        </div>
      </div>

      {hasInvalid ? <p style={{ color: "#475569" }}>Tip: A260 can be 0 or higher, and dilution factor should be above 0.</p> : null}

      <div style={{ marginTop: 22 }}>
        <div>
          <strong>Concentration:</strong> {fmt(result.ugPerMl, 2)} µg/mL
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Same value:</strong> {fmt(result.ngPerUl, 2)} ng/µL
          <span style={{ opacity: 0.7 }}> (since 1 µg/mL = 1 ng/µL)</span>
        </div>
      </div>

      <p style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
        Formula: concentration (µg/mL) = A260 × factor × dilution. Factor used:{" "}
        {result.factor} µg/mL per A260.
      </p>

      <CalcActions
        copyText={
          hasInvalid
            ? undefined
            : `A260\nConcentration: ${result.ugPerMl} µg/mL\nEquivalent: ${result.ngPerUl} ng/µL`
        }
      />
    </main>
  );
}

