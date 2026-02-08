"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type Preset = "ecoli" | "yeast" | "custom";
type VolUnit = "µL" | "mL" | "L";

const VOL_TO_ML: Record<VolUnit, number> = {
  "µL": 1e-3,
  mL: 1,
  L: 1e3,
};

// cells/mL per OD600=1 (rough defaults; user can override)
const PRESET_FACTOR: Record<Exclude<Preset, "custom">, number> = {
  ecoli: 8e8,
  yeast: 3e7,
};

function fmt(x: number, maxFrac = 4) {
  if (!Number.isFinite(x)) return "—";
  const ax = Math.abs(x);
  // avoid scientific notation for normal lab ranges
  if ((ax !== 0 && ax < 1e-6) || ax >= 1e12) return x.toExponential(4);
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export default function OD600Page() {
  const [mode, setMode] = useState<"estimate" | "dilute">("estimate");

  // Mode A: Estimate cells/mL
  const [preset, setPreset] = useState<Preset>("ecoli");
  const [od, setOd] = useState(0.6);
  const [dilution, setDilution] = useState(1); // 1 = undiluted, 10 = 1:10, etc.
  const [customFactor, setCustomFactor] = useState(8e8);

  // Optional: total cells in sample
  const [showTotal, setShowTotal] = useState(true);
  const [sampleVol, setSampleVol] = useState(1);
  const [sampleVolUnit, setSampleVolUnit] = useState<VolUnit>("mL");

  // Mode B: Dilute to target OD (OD1 * V1 = OD2 * V2)
  const [odCurrent, setOdCurrent] = useState(2.0);
  const [odTarget, setOdTarget] = useState(0.5);
  const [finalVol, setFinalVol] = useState(50);
  const [finalVolUnit, setFinalVolUnit] = useState<VolUnit>("mL");

  const hasInvalid =
    mode === "estimate"
      ? od < 0 || dilution <= 0 || (preset === "custom" && customFactor <= 0)
      : odCurrent <= 0 || odTarget <= 0 || finalVol <= 0;

  const factor = useMemo(() => {
    if (preset === "custom") return Number(customFactor) || 0;
    return PRESET_FACTOR[preset];
  }, [preset, customFactor]);

  const estimate = useMemo(() => {
    const OD = Number(od) || 0;
    const D = Number(dilution) || 0;
    const k = Number(factor) || 0;

    if (OD <= 0 || D <= 0 || k <= 0) return null;

    const odCorrected = OD * D;
    const cellsPerML = odCorrected * k;

    const vML = (Number(sampleVol) || 0) * VOL_TO_ML[sampleVolUnit];
    const totalCells = vML > 0 ? cellsPerML * vML : 0;

    return { odCorrected, cellsPerML, totalCells };
  }, [od, dilution, factor, sampleVol, sampleVolUnit]);

  const dilutionPlan = useMemo(() => {
    const OD1 = Number(odCurrent) || 0;
    const OD2 = Number(odTarget) || 0;
    const V2_ml = (Number(finalVol) || 0) * VOL_TO_ML[finalVolUnit];

    if (OD1 <= 0 || OD2 <= 0 || V2_ml <= 0) return null;

    const V1_ml = (OD2 * V2_ml) / OD1;
    const media_ml = V2_ml - V1_ml;

    return { V1_ml, media_ml, V2_ml };
  }, [odCurrent, odTarget, finalVol, finalVolUnit]);

  return (
    <main className="calc-page">
      <h1>OD600</h1>
      <p style={{ opacity: 0.8 }}>
        Estimate cell concentration from OD600, or calculate how to dilute a culture to a target OD.
      </p>

      <div style={{ marginTop: 12 }}>
        <label>
          <input
            type="radio"
            checked={mode === "estimate"}
            onChange={() => setMode("estimate")}
          />{" "}
          Estimate cells/mL
        </label>
        <br />
        <label>
          <input
            type="radio"
            checked={mode === "dilute"}
            onChange={() => setMode("dilute")}
          />{" "}
          Dilute to target OD (OD₁·V₁ = OD₂·V₂)
        </label>
      </div>

      {hasInvalid ? <p style={{ color: "#475569" }}>Tip: OD can be 0 or higher; keep dilution and volume factors above 0.</p> : null}

      {mode === "estimate" ? (
        <>
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ width: 180 }}>Preset</label>
              <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
                <option value="ecoli">E. coli (default)</option>
                <option value="yeast">Yeast (S. cerevisiae)</option>
                <option value="custom">Custom factor</option>
              </select>
              <span style={{ opacity: 0.75 }}>
                (cells/mL per OD=1)
              </span>
            </div>

            {preset === "custom" ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ width: 180 }}>Factor (cells/mL per OD)</label>
                <input
                  type="number"
            onFocus={(e) => e.currentTarget.select()}
                  value={customFactor}
                  onChange={(e) => setCustomFactor(Number(e.target.value))}
                  style={{ padding: 8, width: 220 }}
                />
              </div>
            ) : (
              <div style={{ opacity: 0.85 }}>
                Using factor: <strong>{fmt(factor, 0)}</strong> cells/mL per OD600=1
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ width: 180 }}>OD600 reading</label>
              <input
                type="number"
            onFocus={(e) => e.currentTarget.select()}
                value={od}
                onChange={(e) => setOd(Number(e.target.value))}
                style={{ padding: 8, width: 160 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ width: 180 }}>Dilution factor</label>
              <input
                type="number"
            onFocus={(e) => e.currentTarget.select()}
                value={dilution}
                onChange={(e) => setDilution(Number(e.target.value))}
                style={{ padding: 8, width: 160 }}
              />
              <span style={{ opacity: 0.75 }}>1 = undiluted, 10 = 1:10, etc.</span>
            </div>

            <div style={{ marginTop: 4 }}>
              <label>
                <input
                  type="checkbox"
                  checked={showTotal}
                  onChange={(e) => setShowTotal(e.target.checked)}
                />{" "}
                Also calculate total cells in a sample volume
              </label>
            </div>

            {showTotal ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ width: 180 }}>Sample volume</label>
                <input
                  type="number"
            onFocus={(e) => e.currentTarget.select()}
                  value={sampleVol}
                  onChange={(e) => setSampleVol(Number(e.target.value))}
                  style={{ padding: 8, width: 160 }}
                />
                <select
                  value={sampleVolUnit}
                  onChange={(e) => setSampleVolUnit(e.target.value as VolUnit)}
                >
                  <option value="µL">µL</option>
                  <option value="mL">mL</option>
                  <option value="L">L</option>
                </select>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 18 }}>
            {!estimate ? (
              <p>Enter valid values to see results.</p>
            ) : (
              <>
                <div>
                  <strong>Corrected OD600:</strong> {fmt(estimate.odCorrected, 4)}
                </div>
                <div style={{ marginTop: 6 }}>
                  <strong>Estimated concentration:</strong>{" "}
                  {fmt(estimate.cellsPerML, 0)} cells/mL
                </div>

                {showTotal ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Total cells in sample:</strong>{" "}
                    {fmt(estimate.totalCells, 0)} cells
                  </div>
                ) : null}
              </>
            )}
          </div>

          <p style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
            Note: OD→cells/mL is an estimate and varies by strain, instrument/path length, media, and growth phase.
            Use your lab’s calibration curve if available.
          </p>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ width: 200 }}>Current OD (OD₁)</label>
              <input
                type="number"
            onFocus={(e) => e.currentTarget.select()}
                value={odCurrent}
                onChange={(e) => setOdCurrent(Number(e.target.value))}
                style={{ padding: 8, width: 160 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ width: 200 }}>Target OD (OD₂)</label>
              <input
                type="number"
            onFocus={(e) => e.currentTarget.select()}
                value={odTarget}
                onChange={(e) => setOdTarget(Number(e.target.value))}
                style={{ padding: 8, width: 160 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ width: 200 }}>Final volume (V₂)</label>
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
                <option value="µL">µL</option>
                <option value="mL">mL</option>
                <option value="L">L</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            {!dilutionPlan ? (
              <p>Enter valid values to see the dilution plan.</p>
            ) : (
              <>
                <div>
                  <strong>Add culture (V₁):</strong> {fmt(dilutionPlan.V1_ml, 3)} mL
                </div>
                <div style={{ marginTop: 6 }}>
                  <strong>Add media:</strong> {fmt(dilutionPlan.media_ml, 3)} mL
                </div>
                {dilutionPlan.V1_ml > dilutionPlan.V2_ml ? (
                  <p style={{ marginTop: 10, color: "#475569" }}>
                    Note: required culture volume is higher than final volume. Increase starting OD or reduce target OD.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <p style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
            Tip: This is the same math as C1V1=C2V2, using OD as “concentration”.
          </p>
        </>
      )}

      <CalcActions
        copyText={
          hasInvalid
            ? undefined
            : mode === "estimate"
              ? estimate
                ? `OD600\nEstimated concentration: ${estimate.cellsPerML} cells/mL`
                : undefined
              : dilutionPlan
                ? `OD600 dilution\nAdd culture: ${dilutionPlan.V1_ml} mL\nAdd media: ${dilutionPlan.media_ml} mL`
                : undefined
        }
      />
    </main>
  );
}

