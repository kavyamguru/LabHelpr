"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type ModeKey =
  | "volume"
  | "mass"
  | "amount"
  | "molarity"
  | "massPerVolume"
  | "length"
  | "area";

type ModeDef = {
  id: ModeKey;
  label: string;
  description: string;
  factors: Record<string, number>; // to base unit
};

const MODES: ModeDef[] = [
  {
    id: "volume",
    label: "Volume",
    description: "L, mL, µL, nL, pL, dL, cL",
    factors: {
      L: 1,
      mL: 1e-3,
      "µL": 1e-6,
      nL: 1e-9,
      pL: 1e-12,
      dL: 0.1,
      cL: 0.01,
    },
  },
  {
    id: "mass",
    label: "Mass / Weight",
    description: "g to fg",
    factors: {
      g: 1,
      mg: 1e-3,
      "µg": 1e-6,
      ng: 1e-9,
      pg: 1e-12,
      fg: 1e-15,
    },
  },
  {
    id: "amount",
    label: "Amount of substance",
    description: "mol to fmol",
    factors: {
      mol: 1,
      mmol: 1e-3,
      "µmol": 1e-6,
      nmol: 1e-9,
      pmol: 1e-12,
      fmol: 1e-15,
    },
  },
  {
    id: "molarity",
    label: "Concentration – molar",
    description: "M to fM",
    factors: {
      "M (mol/L)": 1,
      mM: 1e-3,
      "µM": 1e-6,
      nM: 1e-9,
      pM: 1e-12,
      fM: 1e-15,
    },
  },
  {
    id: "massPerVolume",
    label: "Concentration – mass/vol",
    description: "g/L to pg/µL",
    factors: {
      "g/L": 1,
      "mg/mL": 1,
      "µg/mL": 1e-3,
      "ng/mL": 1e-6,
      "pg/mL": 1e-9,
      "µg/µL": 1,
      "ng/µL": 1e-3,
      "pg/µL": 1e-6,
    },
  },
  {
    id: "length",
    label: "Length / distance",
    description: "m to nm",
    factors: {
      m: 1,
      cm: 1e-2,
      mm: 1e-3,
      "µm": 1e-6,
      nm: 1e-9,
    },
  },
  {
    id: "area",
    label: "Area",
    description: "m² to mm²",
    factors: {
      "m²": 1,
      "cm²": 1e-4,
      "mm²": 1e-6,
    },
  },
];

export default function UnitConversionPage() {
  const [modeId, setModeId] = useState<ModeKey>("volume");
  const mode = useMemo(() => MODES.find((m) => m.id === modeId) ?? MODES[0], [modeId]);

  const units = Object.keys(mode.factors);
  const [value, setValue] = useState<number>(1);
  const [from, setFrom] = useState(units[0]);
  const [to, setTo] = useState(units[1] ?? units[0]);

  // Reset selections when mode changes
  const handleModeChange = (id: ModeKey) => {
    const next = MODES.find((m) => m.id === id) ?? MODES[0];
    const keys = Object.keys(next.factors);
    setModeId(id);
    setFrom(keys[0]);
    setTo(keys[1] ?? keys[0]);
  };

  const hasInvalid = !Number.isFinite(value);
  const result = hasInvalid ? NaN : (value * mode.factors[from]) / mode.factors[to];

  return (
    <main className="calc-page">
      <h1>Unit Conversion</h1>
      <p style={{ opacity: 0.8 }}>Covers common wet lab units across volume, mass, molarity, and more.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {MODES.map((m) => (
          <label key={m.id} className="chip" style={{ cursor: "pointer" }}>
            <input
              type="radio"
              checked={modeId === m.id}
              onChange={() => handleModeChange(m.id)}
              style={{ marginRight: 6 }}
            />
            <span style={{ fontWeight: 600 }}>{m.label}</span>
            <span style={{ opacity: 0.6, marginLeft: 6, fontSize: 12 }}>{m.description}</span>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="number"
          onFocus={(e) => e.currentTarget.select()}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ padding: 8, width: 140 }}
        />

        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>

        <span>→</span>

        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>

      {hasInvalid ? <p style={{ color: "#475569" }}>Tip: enter any number to start calculating.</p> : null}

      <div style={{ marginTop: 16 }}>
        <strong>Result:</strong> {Number.isFinite(result) ? result.toLocaleString() : "—"} {to}
      </div>

      <CalcActions
        copyText={
          Number.isFinite(result)
            ? `Unit Conversion (${mode.label})\n${value} ${from} = ${result} ${to}`
            : undefined
        }
      />
    </main>
  );
}
