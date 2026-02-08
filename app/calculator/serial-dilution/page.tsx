"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type VolUnit = "µL" | "mL";
const VOL_TO_UL: Record<VolUnit, number> = { "µL": 1, mL: 1000 };

type ConcUnit = "nM" | "µM" | "mM" | "M";
const CONC_TO_M: Record<ConcUnit, number> = { nM: 1e-9, "µM": 1e-6, mM: 1e-3, M: 1 };

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
            <option value="nM">nM</option>
            <option value="µM">µM</option>
            <option value="mM">mM</option>
            <option value="M">M</option>
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
            <option value="µL">µL</option>
            <option value="mL">mL</option>
          </select>
        </div>

        {/* NEW: toggle */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 220 }}>Tube numbering</label>
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

      {hasInvalid ? (
        <p style={{ marginTop: 18, color: "#475569" }}>Tip: set C0 and final volume above 0, choose factor above 1, and at least 1 step.</p>
      ) : null}

      {!plan ? (
        <p style={{ marginTop: 18 }}>Enter valid values to see the dilution plan.</p>
      ) : (
        <>
          <div style={{ marginTop: 18 }}>
            <strong>Pipetting plan (per tube):</strong>{" "}
            Transfer <strong>{fmt(plan.transfer_uL, 2)} µL</strong> from previous tube + add{" "}
            <strong>{fmt(plan.diluent_uL, 2)} µL</strong> diluent (to reach {fmt(plan.Vfinal_uL, 2)} µL).
          </div>

          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 8 }}>Tube</th>
                  <th style={{ padding: 8 }}>Concentration</th>
                  <th style={{ padding: 8 }}>Transfer from previous</th>
                  <th style={{ padding: 8 }}>Add diluent</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => {
                  const concInUnit = fromMolar(r.conc_M, c0Unit);
                  return (
                    <tr key={r.tube} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: 8 }}>{r.tube}</td>
                      <td style={{ padding: 8 }}>
                        {fmt(concInUnit, 6)} {c0Unit}
                      </td>

                      {r.isStock ? (
                        <>
                          <td style={{ padding: 8, opacity: 0.6 }}>—</td>
                          <td style={{ padding: 8, opacity: 0.6 }}>—</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: 8 }}>{fmt(plan.transfer_uL, 2)} µL</td>
                          <td style={{ padding: 8 }}>{fmt(plan.diluent_uL, 2)} µL</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
            {includeStock
              ? "Note: Tube 0 is the stock solution (C0). Tube 1 is the first dilution. Each next tube is diluted by the same factor."
              : `Note: Tube 1 assumes you start from stock C0. Each next tube is diluted by the same 1:${factor} factor.`}
          </p>
        </>
      )}

      <CalcActions
        copyText={!hasInvalid && plan ? `Serial Dilution\nTransfer per tube: ${plan.transfer_uL} µL\nDiluent per tube: ${plan.diluent_uL} µL` : undefined}
      />
    </main>
  );
}

