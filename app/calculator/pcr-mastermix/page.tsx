"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type Reagent = {
  name: string;
  perRxn: number; // stored in µL
  includeInMix: boolean;
};

type VolUnit = "nL" | "µL" | "mL";
const VOL_TO_UL: Record<VolUnit, number> = { nL: 1e-3, "µL": 1, mL: 1000 };

function fmt(x: number, maxFrac = 2) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

function convertVolume(valueUL: number, unit: VolUnit) {
  return valueUL / VOL_TO_UL[unit];
}

export default function PCRMastermixPage() {
  const [reactions, setReactions] = useState(10);
  const [extraPercent, setExtraPercent] = useState(10);
  const [displayUnit, setDisplayUnit] = useState<VolUnit>("µL");

  const [reagents, setReagents] = useState<Reagent[]>([
    { name: "Water", perRxn: 12.5, includeInMix: true },
    { name: "2× Master Mix", perRxn: 12.5, includeInMix: true },
    { name: "Forward Primer", perRxn: 1.0, includeInMix: true },
    { name: "Reverse Primer", perRxn: 1.0, includeInMix: true },
    { name: "Template DNA", perRxn: 1.0, includeInMix: false }, // often added separately
  ]);

  const multiplier = useMemo(() => {
    const n = Number(reactions) || 0;
    const extra = Number(extraPercent) || 0;
    return n * (1 + extra / 100);
  }, [reactions, extraPercent]);

  const hasInvalid = reactions <= 0 || extraPercent < 0 || reagents.some((r) => r.perRxn < 0);

  const totals = useMemo(() => {
    const rows = reagents.map((r) => {
      const totalUL = r.perRxn * multiplier;
      return { ...r, totalUL };
    });

    const totalMixUL = rows
      .filter((r) => r.includeInMix)
      .reduce((sum, r) => sum + r.totalUL, 0);

    const totalAllUL = rows.reduce((sum, r) => sum + r.totalUL, 0);

    return { rows, totalMixUL, totalAllUL };
  }, [reagents, multiplier]);

  function updateReagent(idx: number, patch: Partial<Reagent>) {
    setReagents((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  }

  function addReagent() {
    setReagents((prev) => [
      ...prev,
      { name: "New reagent", perRxn: 1.0, includeInMix: true },
    ]);
  }

  function removeReagent(idx: number) {
    setReagents((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <main className="calc-page">
      <h1>PCR Mastermix</h1>
      <p style={{ opacity: 0.8 }}>
        Enter per-reaction volumes and we’ll multiply by reaction count plus overage.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
        <div>
          <label>Number of reactions</label>
          <br />
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={reactions}
            onChange={(e) => setReactions(Number(e.target.value))}
            style={{ padding: 8, width: 180 }}
          />
        </div>

        <div>
          <label>Extra (%)</label>
          <br />
          <input
            type="number"
            onFocus={(e) => e.currentTarget.select()}
            value={extraPercent}
            onChange={(e) => setExtraPercent(Number(e.target.value))}
            style={{ padding: 8, width: 180 }}
          />
        </div>

        <div>
          <label>Display unit</label>
          <br />
          <select value={displayUnit} onChange={(e) => setDisplayUnit(e.target.value as VolUnit)} style={{ padding: 8, width: 140 }}>
            <option value="µL">µL</option>
            <option value="nL">nL</option>
            <option value="mL">mL</option>
          </select>
        </div>

        <div style={{ alignSelf: "end", opacity: 0.8 }}>
          Multiplier: <strong>{fmt(multiplier, 2)}</strong> reactions equivalent
        </div>
      </div>

      <div style={{ marginTop: 18, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: 8 }}>Reagent</th>
              <th style={{ padding: 8 }}>Per reaction (µL)</th>
              <th style={{ padding: 8 }}>Include in master mix?</th>
              <th style={{ padding: 8 }}>Total ({displayUnit})</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {totals.rows.map((r, idx) => (
              <tr key={idx} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>
                  <input
                    value={r.name}
                    onChange={(e) => updateReagent(idx, { name: e.target.value })}
                    style={{ padding: 8, width: "100%" }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    type="number"
            onFocus={(e) => e.currentTarget.select()}
                    value={r.perRxn}
                    onChange={(e) => updateReagent(idx, { perRxn: Number(e.target.value) })}
                    style={{ padding: 8, width: 160 }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={r.includeInMix}
                    onChange={(e) => updateReagent(idx, { includeInMix: e.target.checked })}
                  />{" "}
                  Yes
                </td>
                <td style={{ padding: 8 }}>
                  {fmt(convertVolume(r.totalUL, displayUnit), 3)}
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => removeReagent(idx)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 12 }}>
        <button onClick={addReagent}>+ Add reagent</button>
      </div>

      {hasInvalid ? <p style={{ color: "#475569" }}>Tip: keep reactions above 0, and use non-negative extra/reagent values.</p> : null}

      <div style={{ marginTop: 18 }}>
        <div>
          <strong>Total master mix volume:</strong> {fmt(convertVolume(totals.totalMixUL, displayUnit), 3)} {displayUnit}{" "}
          <span style={{ opacity: 0.7 }}>(excluding items unchecked)</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Total volume including everything:</strong> {fmt(convertVolume(totals.totalAllUL, displayUnit), 3)} {displayUnit}
        </div>
      </div>

      <p style={{ marginTop: 14, fontSize: 13, opacity: 0.7 }}>
        Tip: Many protocols add template separately (uncheck “include in master mix”).
      </p>

      <CalcActions
        copyText={
          hasInvalid
            ? undefined
            : `PCR Mastermix\nTotal master mix: ${convertVolume(totals.totalMixUL, displayUnit)} ${displayUnit}\nTotal all reagents: ${convertVolume(totals.totalAllUL, displayUnit)} ${displayUnit}`
        }
      />
    </main>
  );
}
