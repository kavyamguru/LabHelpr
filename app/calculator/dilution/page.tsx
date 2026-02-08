"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type Unit = "nM" | "µM" | "mM" | "M";

const FACTORS: Record<Unit, number> = {
  nM: 1e-9,
  "µM": 1e-6,
  mM: 1e-3,
  M: 1,
};

function toBase(value: number, unit: Unit) {
  return value * FACTORS[unit];
}

function fromBase(value: number, unit: Unit) {
  return value / FACTORS[unit];
}

export default function DilutionPage() {
  // C1 * V1 = C2 * V2
  const [c1, setC1] = useState(10);
  const [c1Unit, setC1Unit] = useState<Unit>("mM");

  const [c2, setC2] = useState(250);
  const [c2Unit, setC2Unit] = useState<Unit>("µM");

  const [v2, setV2] = useState(1000);
  const [v2Unit, setV2Unit] = useState<"µL" | "mL">("µL");

  const hasInvalid = c1 <= 0 || c2 < 0 || v2 <= 0;

  const { v1Value, v1UnitLabel, diluentValue, diluentUnitLabel } = useMemo(() => {
    // Convert concentrations to M
    const C1 = toBase(Number(c1) || 0, c1Unit);
    const C2 = toBase(Number(c2) || 0, c2Unit);

    // Convert V2 to liters
    const V2_L = (Number(v2) || 0) * (v2Unit === "µL" ? 1e-6 : 1e-3);

    // V1 = (C2 * V2) / C1
    const V1_L = C1 === 0 ? 0 : (C2 * V2_L) / C1;

    // Diluent = V2 - V1
    const diluent_L = Math.max(0, V2_L - V1_L);

    // Display results in chosen V2 unit
    const displayFactor = v2Unit === "µL" ? 1e6 : 1e3;
    const unitLabel = v2Unit;

    return {
      v1Value: V1_L * displayFactor,
      v1UnitLabel: unitLabel,
      diluentValue: diluent_L * displayFactor,
      diluentUnitLabel: unitLabel,
    };
  }, [c1, c1Unit, c2, c2Unit, v2, v2Unit]);

  return (
    <main className="calc-page">
      <h1>Dilution Calculator</h1>
      <p style={{ opacity: 0.8 }}>
        Uses <strong>C1 × V1 = C2 × V2</strong> to compute how much stock (V1) and diluent to add.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 90 }}>Stock (C1)</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={c1}
            onChange={(e) => setC1(Number(e.target.value))}
            style={{ padding: 8, width: 140 }}
          />
          <select value={c1Unit} onChange={(e) => setC1Unit(e.target.value as Unit)}>
            {Object.keys(FACTORS).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 90 }}>Target (C2)</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={c2}
            onChange={(e) => setC2(Number(e.target.value))}
            style={{ padding: 8, width: 140 }}
          />
          <select value={c2Unit} onChange={(e) => setC2Unit(e.target.value as Unit)}>
            {Object.keys(FACTORS).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 90 }}>Final (V2)</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={v2}
            onChange={(e) => setV2(Number(e.target.value))}
            style={{ padding: 8, width: 140 }}
          />
          <select value={v2Unit} onChange={(e) => setV2Unit(e.target.value as "µL" | "mL")}>
            <option value="µL">µL</option>
            <option value="mL">mL</option>
          </select>
        </div>
      </div>

      {hasInvalid ? (
        <p style={{ color: "#475569" }}>Tip: set stock concentration and final volume above 0; target concentration can be 0 or higher.</p>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <div>
          <strong>Take (V1):</strong>{" "}
          {Number.isFinite(v1Value) ? v1Value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}{" "}
          {v1UnitLabel}
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Add diluent:</strong>{" "}
          {Number.isFinite(diluentValue)
            ? diluentValue.toLocaleString(undefined, { maximumFractionDigits: 4 })
            : "—"}{" "}
          {diluentUnitLabel}
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 13, opacity: 0.7 }}>
        Tip: If V1 is larger than V2, your stock is too dilute to reach that target.
      </p>

      <CalcActions
        copyText={
          hasInvalid
            ? undefined
            : `Dilution\nTake: ${v1Value} ${v1UnitLabel}\nAdd diluent: ${diluentValue} ${diluentUnitLabel}`
        }
      />
    </main>
  );
}

