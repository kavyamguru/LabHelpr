"use client";

import { useState } from "react";
import CalcActions from "../_components/CalcActions";

const VOLUME_FACTORS: Record<string, number> = {
  "µL": 1e-6,
  "mL": 1e-3,
  "L": 1,
};

const CONC_FACTORS: Record<string, number> = {
  "nM": 1e-9,
  "µM": 1e-6,
  "mM": 1e-3,
  "M": 1,
};

export default function UnitConversionPage() {
  const [value, setValue] = useState<number>(1);
  const [from, setFrom] = useState("µL");
  const [to, setTo] = useState("mL");
  const [mode, setMode] = useState<"volume" | "concentration">("volume");

  const factors = mode === "volume" ? VOLUME_FACTORS : CONC_FACTORS;
  const hasInvalid = !Number.isFinite(value);
  const result = hasInvalid ? NaN : (value * factors[from]) / factors[to];

  return (
    <main className="calc-page">
      <h1>Unit Conversion</h1>

      <div style={{ marginBottom: 12 }}>
        <label>
          <input
            type="radio"
            checked={mode === "volume"}
            onChange={() => {
              setMode("volume");
              setFrom("µL");
              setTo("mL");
            }}
          />
          Volume
        </label>
        {"  "}
        <label>
          <input
            type="radio"
            checked={mode === "concentration"}
            onChange={() => {
              setMode("concentration");
              setFrom("µM");
              setTo("mM");
            }}
          />
          Concentration
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="number"
            onFocus={(e) => e.currentTarget.select()}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ padding: 8, width: 120 }}
        />

        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          {Object.keys(factors).map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>

        <span>→</span>

        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {Object.keys(factors).map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>

      {hasInvalid ? <p style={{ color: "#475569" }}>Tip: enter any number to start calculating.</p> : null}

      <div style={{ marginTop: 16 }}>
        <strong>Result:</strong> {Number.isFinite(result) ? result.toLocaleString() : "—"} {to}
      </div>

      <CalcActions copyText={Number.isFinite(result) ? `Unit Conversion\n${value} ${from} = ${result} ${to}` : undefined} />
    </main>
  );
}

