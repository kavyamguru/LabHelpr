"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type VolUnit = "pL" | "nL" | "µL" | "mL";
const VOL_TO_UL: Record<VolUnit, number> = { pL: 1e-6, nL: 1e-3, "µL": 1, mL: 1000 };

type ConcUnit = "fM" | "pM" | "nM" | "µM" | "mM" | "M";
const CONC_TO_M: Record<ConcUnit, number> = { fM: 1e-15, pM: 1e-12, nM: 1e-9, "µM": 1e-6, mM: 1e-3, M: 1 };

function fmt(x: number, maxFrac = 4) {
  if (!Number.isFinite(x)) return "—";
  const ax = Math.abs(x);
  // scientific for very small/large
  if ((ax !== 0 && ax < 1e-6) || ax >= 1e9) return x.toExponential(4);
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

function fromMolar(M: number, unit: ConcUnit) {
  return M / CONC_TO_M[unit];
}

function fromUL(valueUL: number, unit: VolUnit) {
  return valueUL / VOL_TO_UL[unit];
}

export default function SerialDilutionPage() {
  const [c0, setC0] = useState(10);
  const [c0Unit, setC0Unit] = useState<ConcUnit>("mM");

  // factor = 10 means 1:10 each step
  const [factor, setFactor] = useState(10);

  const [steps, setSteps] = useState(6);

  const [finalVol, setFinalVol] = useState(1000);
  const [finalVolUnit, setFinalVolUnit] = useState<VolUnit>("µL");

  // NEW: include stock as Tube 0
  const [includeStock, setIncludeStock] = useState(false);

  // Choose a nice pipetting scheme: transfer = finalVol / factor
  const hasInvalid = c0 <= 0 || factor <= 1 || steps <= 0 || finalVol <= 0;

  const plan = useMemo(() => {
    const C0_M = (Number(c0) || 0) * CONC_TO_M[c0Unit];
    const F = Number(factor) || 0;
    const N = Math.max(1, Math.floor(Number(steps) || 1));

    const Vfinal_uL = (Number(finalVol) || 0) * VOL_TO_UL[finalVolUnit];
    if (C0_M <= 0 || F <= 0 || Vfinal_uL <= 0) return null;

    const transfer_uL = Vfinal_uL / F;
    const diluent_uL = Vfinal_uL - transfer_uL;

    const rows: Array<{ tube: number; conc_M: number; isStock: boolean }> = [];

    // Optional Tube 0
    if (includeStock) {
      rows.push({
        tube: 0,
        conc_M: C0_M,
        isStock: true,
      });
    }

    // Tubes 1..N are dilutions: C0/F, C0/F^2, ...
    for (let i = 0; i < N; i++) {
      const step = i + 1;
      rows.push({
        tube: step,
        conc_M: C0_M / Math.pow(F, step),
        isStock: false,
      });
    }

    return { rows, transfer_uL, diluent_uL, Vfinal_uL, C0_M };
  }, [c0, c0Unit, factor, steps, finalVol, finalVolUnit, includeStock]);

  return (
    <main className="calc-page">
      <h1>Serial Dilution</h1>
      <p style={{ opacity: 0.8 }}>
        Calculates stepwise concentrations and pipetting volumes for a serial dilution series.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 220 }}>Starting concentration (C0)</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={c0}
            onChange={(e) => setC0(Number(e.target.value))}
            style={{ padding: 8, width: 160 }}
          />
          <select value={c0Unit} onChange={(e) => setC0Unit(e.target.value as ConcUnit)}>
            {Object.keys(CONC_TO_M).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 220 }}>Dilution each step (1:X)</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={factor}
            onChange={(e) => setFactor(Number(e.target.value))}
            style={{ padding: 8, width: 160 }}
          />
          <span style={{ opacity: 0.75 }}>e.g., 10 = 1:10, 2 = 1:2</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 220 }}>Number of tubes (steps)</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            style={{ padding: 8, width: 160 }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 220 }}>Final volume per tube</label>
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={finalVol}
            onChange={(e) => setFinalVol(Number(e.target.value))}
            style={{ padding: 8, width: 160 }}
          />
          <select value={finalVolUnit} onChange={(e) => setFinalVolUnit(e.target.value as VolUnit)}>
            {Object.keys(VOL_TO_UL).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 4 }}>
          <label>
            <input
              type="checkbox"
              checked={includeStock}
              onChange={(e) => setIncludeStock(e.target.checked)}
            />{" "}
            Include stock as Tube 0
          </label>
        </div>
      </div>

      {hasInvalid ? <p style={{ color: "#475569" }}>Tip: C0 &gt; 0, factor &gt; 1, steps &gt; 0, final volume &gt; 0.</p> : null}

      {!plan ? (
        <p style={{ marginTop: 10 }}>Enter valid values to see the series.</p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 700 }}>Pipetting per tube</div>
          <ul style={{ lineHeight: 1.6 }}>
            <li>
              Transfer: <strong>{fmt(fromUL(plan.transfer_uL, finalVolUnit), 4)} {finalVolUnit}</strong>
            </li>
            <li>
              Add diluent: <strong>{fmt(fromUL(plan.diluent_uL, finalVolUnit), 4)} {finalVolUnit}</strong>
            </li>
          </ul>

          <div style={{ marginTop: 12, fontWeight: 700 }}>Concentrations</div>
          <table className="calc-table" style={{ marginTop: 6, width: "100%", maxWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Tube</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Concentration</th>
                {includeStock ? <th style={{ textAlign: "left", padding: "6px 8px" }}>Note</th> : null}
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.tube}>
                  <td style={{ padding: "6px 8px" }}>{row.tube}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {fmt(fromMolar(row.conc_M, c0Unit), 6)} {c0Unit}
                  </td>
                  {includeStock ? (
                    <td style={{ padding: "6px 8px", opacity: 0.75 }}>
                      {row.isStock ? "Stock" : "Dilution"}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
        Transfer = final volume / dilution factor. Adjust factor/volumes to fit pipetting range.
      </p>

      <CalcActions
        copyText={
          !plan || hasInvalid
            ? undefined
            : `Serial Dilution\nTransfer: ${fromUL(plan.transfer_uL, finalVolUnit)} ${finalVolUnit}\nDiluent: ${fromUL(plan.diluent_uL, finalVolUnit)} ${finalVolUnit}`
        }
      />
    </main>
  );
}
