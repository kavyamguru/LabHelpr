"use client";

import { useMemo, useState } from "react";
import { molecularWeightFromFormula } from "../../../lib/lab/molecularWeight";
import CalcActions from "../_components/CalcActions";

function fmt(x: number, maxFrac = 4) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export default function MolecularWeightPage() {
  const [formula, setFormula] = useState("NaCl");
  const result = useMemo(() => molecularWeightFromFormula(formula), [formula]);

  return (
    <main className="calc-page">
      <h1>Molecular Weight</h1>
      <p style={{ opacity: 0.8 }}>
        Enter a chemical formula to estimate molecular weight (g/mol). Supports parentheses and hydrates (·).
      </p>

      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ width: 170 }}>Formula</label>
        <input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="e.g., C6H12O6 or Ca(OH)2 or MgSO4·7H2O"
          style={{ width: 420 }}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        {result.ok ? (
          <div>
            <strong>Molecular weight:</strong> {fmt(result.mw_g_per_mol, 4)} g/mol
          </div>
        ) : (
          <div style={{ color: "#475569" }}>
            <strong>Error:</strong> {result.error}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
        Examples: NaCl, C6H12O6, Ca(OH)2, (NH4)2SO4, MgSO4·7H2O
      </div>

      <CalcActions
        copyText={result.ok ? `Molecular Weight\n${formula} = ${result.mw_g_per_mol} g/mol` : undefined}
      />
    </main>
  );
}
