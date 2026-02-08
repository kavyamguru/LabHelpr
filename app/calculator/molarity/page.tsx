"use client";

import { useMemo, useState } from "react";
import { molecularWeightFromFormula } from "../../../lib/lab/molecularWeight";
import CalcActions from "../_components/CalcActions";

type VolUnit = "µL" | "mL" | "L";
const VOL_TO_L: Record<VolUnit, number> = {
  "µL": 1e-6,
  mL: 1e-3,
  L: 1,
};

type ConcUnit = "nM" | "µM" | "mM" | "M";
const CONC_TO_M: Record<ConcUnit, number> = {
  nM: 1e-9,
  "µM": 1e-6,
  mM: 1e-3,
  M: 1,
};

function fmt(x: number, maxFrac = 6) {
  if (!Number.isFinite(x)) return "—";
  const ax = Math.abs(x);
  if ((ax !== 0 && ax < 1e-6) || ax >= 1e9) return x.toExponential(4);
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

// Convert from M (mol/L) into a chosen concentration unit
function fromM(valueM: number, unit: ConcUnit) {
  return valueM / CONC_TO_M[unit];
}

export default function MolarityPage() {
  const [mode, setMode] = useState<"mass-needed" | "conc-from-mass">("mass-needed");

  // Inputs
  const [formula, setFormula] = useState<string>("");
  const [mwManual, setMwManual] = useState<number>(0);
  const [formulaError, setFormulaError] = useState<string>("");

  // Common inputs
  const [vol, setVol] = useState<number>(1);
  const [volUnit, setVolUnit] = useState<VolUnit>("L");

  // Mode A: mass needed
  const [targetConc, setTargetConc] = useState<number>(150);
  const [targetConcUnit, setTargetConcUnit] = useState<ConcUnit>("mM");

  // Mode B: concentration from mass
  const [massG, setMassG] = useState<number>(1);
  const [outConcUnit, setOutConcUnit] = useState<ConcUnit>("mM");

  const MW = Number(mwManual) || 0;

  const result = useMemo(() => {
    const V_L = (Number(vol) || 0) * VOL_TO_L[volUnit];

    // Avoid nonsense results when MW/volume missing
    if (MW <= 0 || V_L <= 0) {
      return { grams: NaN, molarity_M: NaN };
    }

    if (mode === "mass-needed") {
      const C_M = (Number(targetConc) || 0) * CONC_TO_M[targetConcUnit]; // mol/L
      const grams = C_M * V_L * MW;
      return { grams, molarity_M: NaN };
    } else {
      const grams = Number(massG) || 0;
      const molarity_M = (grams / MW) / V_L;
      return { grams: NaN, molarity_M };
    }
  }, [mode, MW, vol, volUnit, targetConc, targetConcUnit, massG]);

  const hasInvalid =
    vol <= 0 ||
    MW <= 0 ||
    (mode === "mass-needed" ? targetConc < 0 : massG < 0);

  return (
    <main className="calc-page">
      <h1>Molarity Calculator</h1>
      <p style={{ opacity: 0.8 }}>
        Calculate grams needed for a solution, or calculate concentration from a weighed mass.
      </p>

      <div style={{ marginTop: 12 }}>
        <label>
          <input
            type="radio"
            checked={mode === "mass-needed"}
            onChange={() => setMode("mass-needed")}
          />{" "}
          Mass needed (given M, V, MW)
        </label>
        <br />
        <label>
          <input
            type="radio"
            checked={mode === "conc-from-mass"}
            onChange={() => setMode("conc-from-mass")}
          />{" "}
          Concentration from mass (given g, V, MW)
        </label>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {/* Formula input: updates MW field directly */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 170 }}>Formula (optional)</label>

          <input
            value={formula}
            onChange={(e) => {
              const value = e.target.value;
              setFormula(value);

              const trimmed = value.trim();
              if (!trimmed) {
                setFormulaError("");
                return;
              }

              const parsed = molecularWeightFromFormula(trimmed);
              if (parsed.ok) {
                setMwManual(Number(parsed.mw_g_per_mol.toFixed(4)));
                setFormulaError("");
              } else {
                setFormulaError(parsed.error);
              }
            }}
            placeholder="e.g., NaCl, Ca(OH)2, MgSO4·7H2O"
            style={{ padding: 8, width: 260 }}
          />

          {formulaError ? (
            <span style={{ color: "#475569", fontSize: 12 }}>
              <strong>Error:</strong> {formulaError}
            </span>
          ) : null}
        </div>

        {/* Manual MW input */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 170 }}>Molecular weight (g/mol)</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={mwManual}
            onChange={(e) => {
              setMwManual(Number(e.target.value));
              setFormula("");
              setFormulaError("");
            }}
            placeholder="Enter MW if known"
            style={{ padding: 8, width: 160 }}
            min={0}
          />
        </div>

        {/* Volume */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 170 }}>Final volume (V)</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={vol}
            onChange={(e) => setVol(Number(e.target.value))}
            style={{ padding: 8, width: 160 }}
          />
          <select value={volUnit} onChange={(e) => setVolUnit(e.target.value as VolUnit)}>
            <option value="µL">µL</option>
            <option value="mL">mL</option>
            <option value="L">L</option>
          </select>
        </div>

        {/* Mode-specific */}
        {mode === "mass-needed" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ width: 170 }}>Target concentration (C)</label>
            <input
              type="number"
            onFocus={(e) => e.currentTarget.select()}
              value={targetConc}
              onChange={(e) => setTargetConc(Number(e.target.value))}
              style={{ padding: 8, width: 160 }}
            />
            <select
              value={targetConcUnit}
              onChange={(e) => setTargetConcUnit(e.target.value as ConcUnit)}
            >
              <option value="nM">nM</option>
              <option value="µM">µM</option>
              <option value="mM">mM</option>
              <option value="M">M</option>
            </select>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ width: 170 }}>Mass weighed (g)</label>
            <input
              type="number"
            onFocus={(e) => e.currentTarget.select()}
              value={massG}
              onChange={(e) => setMassG(Number(e.target.value))}
              style={{ padding: 8, width: 160 }}
            />
          </div>
        )}
      </div>

      {/* Output */}
      {hasInvalid ? (
        <p style={{ color: "#475569" }}>
          Tip: add a positive volume and molecular weight, then fill concentration or mass.
        </p>
      ) : null}

      <div style={{ marginTop: 22 }}>
        {MW <= 0 ? (
          <div style={{ color: "#475569" }}>
            <strong>Enter either a valid formula or a molecular weight to calculate.</strong>
          </div>
        ) : mode === "mass-needed" ? (
          <div>
            <strong>Weigh:</strong> {fmt(result.grams, 6)} g
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>Concentration:</strong>
            <span>
              {fmt(fromM(result.molarity_M, outConcUnit), 6)} {outConcUnit}
            </span>
            <select value={outConcUnit} onChange={(e) => setOutConcUnit(e.target.value as ConcUnit)}>
              <option value="nM">nM</option>
              <option value="µM">µM</option>
              <option value="mM">mM</option>
              <option value="M">M</option>
            </select>
          </div>
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
        Tip: For buffers/mixtures, MW may be an “effective MW” or you may need component-wise calculations.
      </p>

      <CalcActions
        copyText={
          hasInvalid
            ? undefined
            : mode === "mass-needed"
              ? `Molarity (mass needed)\nWeigh: ${result.grams} g`
              : `Molarity (from mass)\nConcentration: ${fromM(result.molarity_M, outConcUnit)} ${outConcUnit}`
        }
      />
    </main>
  );
}

