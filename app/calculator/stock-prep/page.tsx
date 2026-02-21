"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type Mode = "molar" | "percent-wv" | "percent-vv";

type VolUnit = "pL" | "nL" | "µL" | "mL" | "L";
const VOL_TO_ML: Record<VolUnit, number> = { pL: 1e-9, nL: 1e-6, "µL": 1e-3, mL: 1, L: 1000 };

function fmt(x: number, maxFrac = 4) {
  if (!Number.isFinite(x)) return "—";
  const ax = Math.abs(x);
  if ((ax !== 0 && ax < 1e-6) || ax >= 1e9) return x.toExponential(4);
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export default function StockPrepPage() {
  const [mode, setMode] = useState<Mode>("molar");

  // shared
  const [finalVol, setFinalVol] = useState(100);
  const [finalVolUnit, setFinalVolUnit] = useState<VolUnit>("mL");

  // molar
  const [mw, setMw] = useState(58.44);
  const [molarity, setMolarity] = useState(1); // M

  // percent
  const [percent, setPercent] = useState(1);

  const hasInvalid =
    finalVol <= 0 ||
    (mode === "molar" ? mw <= 0 || molarity <= 0 : percent < 0);

  const result = useMemo(() => {
    const V_ml = (Number(finalVol) || 0) * VOL_TO_ML[finalVolUnit];
    if (V_ml <= 0) return null;

    if (mode === "molar") {
      const M = Number(molarity) || 0;
      const MW = Number(mw) || 0;
      if (M <= 0 || MW <= 0) return null;

      const liters = V_ml / 1000;
      const grams = M * liters * MW;
      return { grams, V_ml };
    }

    if (mode === "percent-wv") {
      // w/v% = grams per 100 mL
      const grams = (Number(percent) / 100) * V_ml;
      return { grams, V_ml };
    }

    // percent-vv
    const solute_ml = (Number(percent) / 100) * V_ml;
    const diluent_ml = V_ml - solute_ml;
    return { solute_ml, diluent_ml, V_ml };
  }, [mode, finalVol, finalVolUnit, mw, molarity, percent]);

  return (
    <main className="calc-page">
      <h1>Stock Preparation</h1>
      <p style={{ opacity: 0.8 }}>
        Prepare common laboratory stock solutions from scratch.
      </p>

      {/* Mode selector */}
      <div style={{ marginTop: 12 }}>
        <label>
          <input
            type="radio"
            checked={mode === "molar"}
            onChange={() => setMode("molar")}
          />{" "}
          Molar stock (M, mM)
        </label>
        <br />
        <label>
          <input
            type="radio"
            checked={mode === "percent-wv"}
            onChange={() => setMode("percent-wv")}
          />{" "}
          Percent w/v (g per 100 mL)
        </label>
        <br />
        <label>
          <input
            type="radio"
            checked={mode === "percent-vv"}
            onChange={() => setMode("percent-vv")}
          />{" "}
          Percent v/v (mL per 100 mL)
        </label>
      </div>

      {/* Inputs */}
      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 220 }}>Final volume</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={finalVol}
            onChange={(e) => setFinalVol(Number(e.target.value))}
            style={{ padding: 8, width: 160 }}
          />
          <select
            value={finalVolUnit}
            onChange={(e) => setFinalVolUnit(e.target.value as VolUnit)}
          >
            {Object.keys(VOL_TO_ML).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {mode === "molar" && (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ width: 220 }}>Target molarity (M)</label>
              <input
                type="number"
            onFocus={(e) => e.currentTarget.select()}
                value={molarity}
                onChange={(e) => setMolarity(Number(e.target.value))}
                style={{ padding: 8, width: 160 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ width: 220 }}>Molecular weight (g/mol)</label>
              <input
                type="number"
            onFocus={(e) => e.currentTarget.select()}
                value={mw}
                onChange={(e) => setMw(Number(e.target.value))}
                style={{ padding: 8, width: 160 }}
              />
            </div>
          </>
        )}

        {(mode === "percent-wv" || mode === "percent-vv") && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ width: 220 }}>Target percent (%)</label>
            <input
              type="number"
            onFocus={(e) => e.currentTarget.select()}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              style={{ padding: 8, width: 160 }}
            />
          </div>
        )}
      </div>

      {/* Output */}
      {hasInvalid ? <p style={{ color: "#475569" }}>Tip: keep final volume above 0 and use non-negative concentration values.</p> : null}

      <div style={{ marginTop: 22 }}>
        {!result ? (
          <p>Enter valid values to see the preparation steps.</p>
        ) : mode === "percent-vv" ? (
          <>
            <div>
              <strong>Add stock:</strong> {fmt(result.solute_ml ?? 0, 3)} mL
            </div>
            <div>
              <strong>Add diluent:</strong> {fmt(result.diluent_ml ?? 0, 3)} mL
            </div>
          </>
        ) : (
          <div>
            <strong>Weigh:</strong> {fmt(result.grams ?? 0, 4)} g {" "}
            <span style={{ opacity: 0.7 }}>
              (bring up to {fmt(result.V_ml ?? 0, 2)} mL)
            </span>
          </div>
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
        Tip: Always dissolve solids fully before bringing to final volume.
      </p>

      <CalcActions
        copyText={
          !result || hasInvalid
            ? undefined
            : mode === "percent-vv"
              ? `Stock Prep\nAdd stock: ${result.solute_ml} mL\nAdd diluent: ${result.diluent_ml} mL`
              : `Stock Prep\nWeigh: ${result.grams} g`
        }
      />
    </main>
  );
}
