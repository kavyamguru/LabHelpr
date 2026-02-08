"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type PlatePreset = "6-well" | "12-well" | "24-well" | "48-well" | "96-well" | "custom";
type VolUnit = "µL" | "mL";

type TreatmentGroup = {
  name: string;
  wells: string;
  targetCellsPerWell: string;
};

const PRESETS: Record<Exclude<PlatePreset, "custom">, { wells: number; wellVolumeUL: number }> = {
  "6-well": { wells: 6, wellVolumeUL: 2000 },
  "12-well": { wells: 12, wellVolumeUL: 1000 },
  "24-well": { wells: 24, wellVolumeUL: 500 },
  "48-well": { wells: 48, wellVolumeUL: 300 },
  "96-well": { wells: 96, wellVolumeUL: 100 },
};

const VOL_TO_UL: Record<VolUnit, number> = { "µL": 1, mL: 1000 };

function fmt(x: number, maxFrac = 2) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

function fromUL(valueUL: number, unit: VolUnit) {
  return valueUL / VOL_TO_UL[unit];
}

function computePlanForTarget(
  cStock: number,
  targetCellsPerWell: number,
  wells: number,
  vWellUL: number,
  overagePercent: number,
) {
  const vWellMl = vWellUL / 1000;

  const stockPerWellMl = targetCellsPerWell / cStock;
  const stockPerWellUL = stockPerWellMl * 1000;
  const mediaPerWellUL = vWellUL - stockPerWellUL;

  const targetMixCellsPerMl = targetCellsPerWell / vWellMl;
  const totalDispenseUL = wells * vWellUL;
  const totalMixUL = totalDispenseUL * (1 + overagePercent / 100);
  const totalMixMl = totalMixUL / 1000;

  let stockForMixMl = NaN;
  let diluentForMixMl = NaN;
  let dilutionRatio = NaN;

  if (cStock >= targetMixCellsPerMl) {
    stockForMixMl = (targetMixCellsPerMl * totalMixMl) / cStock;
    diluentForMixMl = totalMixMl - stockForMixMl;
    dilutionRatio = cStock / targetMixCellsPerMl;
  }

  return {
    stockPerWellUL,
    mediaPerWellUL,
    targetMixCellsPerMl,
    totalDispenseUL,
    totalMixUL,
    totalMixMl,
    stockForMixMl,
    diluentForMixMl,
    dilutionRatio,
    canDilute: cStock >= targetMixCellsPerMl,
  };
}

export default function CellSeedingPage() {
  const [preset, setPreset] = useState<PlatePreset>("24-well");
  const [wellsToSeed, setWellsToSeed] = useState<string>("24");
  const [dispenseVol, setDispenseVol] = useState<string>("500");
  const [dispenseUnit, setDispenseUnit] = useState<VolUnit>("µL");

  const [measuredCellsPerMl, setMeasuredCellsPerMl] = useState<string>("1000000");
  const [targetCellsPerWell, setTargetCellsPerWell] = useState<string>("50000");
  const [overagePercent, setOveragePercent] = useState<string>("10");

  const [useTreatments, setUseTreatments] = useState(false);
  const [groups, setGroups] = useState<TreatmentGroup[]>([
    { name: "Treatment 1", wells: "8", targetCellsPerWell: "50000" },
    { name: "Treatment 2", wells: "8", targetCellsPerWell: "50000" },
    { name: "Treatment 3", wells: "8", targetCellsPerWell: "50000" },
  ]);

  const activePreset = preset === "custom" ? null : PRESETS[preset];

  const result = useMemo(() => {
    const cStock = Number(measuredCellsPerMl) || 0;
    const wells = Number(wellsToSeed) || 0;
    const vWellInput = Number(dispenseVol) || 0;
    const vWellUL = vWellInput * VOL_TO_UL[dispenseUnit];
    const overage = Math.max(0, Number(overagePercent) || 0);

    if (cStock <= 0 || wells <= 0 || vWellUL <= 0) return null;

    if (!useTreatments) {
      const target = Number(targetCellsPerWell) || 0;
      if (target <= 0) return null;
      return {
        mode: "single" as const,
        wells,
        vWellUL,
        overage,
        plan: computePlanForTarget(cStock, target, wells, vWellUL, overage),
      };
    }

    const groupPlans = groups.map((g) => {
      const gw = Number(g.wells) || 0;
      const target = Number(g.targetCellsPerWell) || 0;
      if (gw <= 0 || target <= 0) return null;
      return {
        name: g.name || "Treatment",
        wells: gw,
        target,
        ...computePlanForTarget(cStock, target, gw, vWellUL, overage),
      };
    });

    if (groupPlans.some((g) => g === null)) return null;

    const validGroups = groupPlans as Array<{
      name: string;
      wells: number;
      target: number;
      stockPerWellUL: number;
      mediaPerWellUL: number;
      targetMixCellsPerMl: number;
      totalDispenseUL: number;
      totalMixUL: number;
      totalMixMl: number;
      stockForMixMl: number;
      diluentForMixMl: number;
      dilutionRatio: number;
      canDilute: boolean;
    }>;

    const assignedWells = validGroups.reduce((s, g) => s + g.wells, 0);

    return {
      mode: "group" as const,
      wells,
      assignedWells,
      vWellUL,
      overage,
      groups: validGroups,
    };
  }, [measuredCellsPerMl, wellsToSeed, dispenseVol, dispenseUnit, overagePercent, useTreatments, targetCellsPerWell, groups]);

  const invalid = !result;

  return (
    <main className="calc-page">
      <h1>Mammalian Cell Seeding</h1>
      <p style={{ opacity: 0.85 }}>
        Plan per-well seeding volume and full-plate dilution/mix from your measured cells/mL and target cells/well.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Plate format</label>
          <select
            value={preset}
            onChange={(e) => {
              const next = e.target.value as PlatePreset;
              setPreset(next);
              if (next !== "custom") {
                setWellsToSeed(String(PRESETS[next].wells));
                setDispenseUnit("µL");
                setDispenseVol(String(PRESETS[next].wellVolumeUL));
              }
            }}
          >
            <option value="6-well">6-well</option>
            <option value="12-well">12-well</option>
            <option value="24-well">24-well</option>
            <option value="48-well">48-well</option>
            <option value="96-well">96-well</option>
            <option value="custom">Custom</option>
          </select>
          {activePreset ? <span style={{ opacity: 0.7, fontSize: 13 }}>Preset loaded</span> : null}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Number of wells to seed</label>
          <input type="text" inputMode="numeric" onFocus={(e) => e.currentTarget.select()} value={wellsToSeed} onChange={(e) => setWellsToSeed(e.target.value)} style={{ width: 160 }} />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Dispense volume per well</label>
          <input type="text" inputMode="decimal" onFocus={(e) => e.currentTarget.select()} value={dispenseVol} onChange={(e) => setDispenseVol(e.target.value)} style={{ width: 160 }} />
          <select value={dispenseUnit} onChange={(e) => setDispenseUnit(e.target.value as VolUnit)}>
            <option value="µL">µL</option>
            <option value="mL">mL</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Measured cell concentration</label>
          <input type="text" inputMode="decimal" onFocus={(e) => e.currentTarget.select()} value={measuredCellsPerMl} onChange={(e) => setMeasuredCellsPerMl(e.target.value)} style={{ width: 200 }} />
          <span>cells/mL</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Extra mix (dead volume)</label>
          <input type="text" inputMode="decimal" onFocus={(e) => e.currentTarget.select()} value={overagePercent} onChange={(e) => setOveragePercent(e.target.value)} style={{ width: 120 }} />
          <span>%</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Plate treatment setup</label>
          <label>
            <input type="checkbox" checked={useTreatments} onChange={(e) => setUseTreatments(e.target.checked)} /> Use treatment groups
          </label>
        </div>

        {!useTreatments ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ width: 230 }}>Target seeding density</label>
            <input type="text" inputMode="decimal" onFocus={(e) => e.currentTarget.select()} value={targetCellsPerWell} onChange={(e) => setTargetCellsPerWell(e.target.value)} style={{ width: 200 }} />
            <span>cells/well</span>
          </div>
        ) : (
          <section className="calc-card" style={{ marginTop: 4 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Custom treatment groups</div>
            <div style={{ display: "grid", gap: 10 }}>
              {groups.map((g, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr auto", gap: 8, alignItems: "center" }}>
                  <input
                    value={g.name}
                    onChange={(e) => {
                      const next = [...groups];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setGroups(next);
                    }}
                    placeholder={`Treatment ${idx + 1}`}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    onFocus={(e) => e.currentTarget.select()}
                    value={g.wells}
                    onChange={(e) => {
                      const next = [...groups];
                      next[idx] = { ...next[idx], wells: e.target.value };
                      setGroups(next);
                    }}
                    placeholder="Wells"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    onFocus={(e) => e.currentTarget.select()}
                    value={g.targetCellsPerWell}
                    onChange={(e) => {
                      const next = [...groups];
                      next[idx] = { ...next[idx], targetCellsPerWell: e.target.value };
                      setGroups(next);
                    }}
                    placeholder="cells/well"
                  />
                  <button
                    type="button"
                    onClick={() => setGroups((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              style={{ marginTop: 10 }}
              onClick={() => setGroups((prev) => [...prev, { name: `Treatment ${prev.length + 1}`, wells: "", targetCellsPerWell: targetCellsPerWell || "50000" }])}
            >
              + Add treatment group
            </button>
          </section>
        )}
      </div>

      {invalid ? (
        <p style={{ marginTop: 16, color: "#64748b" }}>Enter positive values to generate a seeding plan.</p>
      ) : result.mode === "single" ? (
        <>
          <section className="calc-card" style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Per-well volume from measured stock</div>
            <div>
              Add <strong>{fmt(fromUL(result.plan.stockPerWellUL, dispenseUnit), 2)} {dispenseUnit}</strong> cell suspension + <strong>{fmt(fromUL(result.plan.mediaPerWellUL, dispenseUnit), 2)} {dispenseUnit}</strong> media per well.
            </div>
            {result.plan.mediaPerWellUL < 0 ? (
              <p style={{ marginTop: 8, color: "#64748b" }}>
                Target is too high for this stock at selected well volume. Concentrate cells or increase dispense volume.
              </p>
            ) : null}
          </section>

          <section className="calc-card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Whole-plate seeding mix</div>
            <div>Target mix concentration: <strong>{fmt(result.plan.targetMixCellsPerMl, 0)} cells/mL</strong></div>
            <div style={{ marginTop: 4 }}>Total dispense volume: <strong>{fmt(fromUL(result.plan.totalDispenseUL, dispenseUnit), 2)} {dispenseUnit}</strong></div>
            <div style={{ marginTop: 4 }}>Prepare total mix: <strong>{fmt(fromUL(result.plan.totalMixUL, dispenseUnit), 2)} {dispenseUnit}</strong> ({fmt(result.plan.totalMixMl, 3)} mL)</div>

            {result.plan.canDilute ? (
              <div style={{ marginTop: 8 }}>
                Mix <strong>{fmt(result.plan.stockForMixMl, 3)} mL</strong> cell stock + <strong>{fmt(result.plan.diluentForMixMl, 3)} mL</strong> media
                {Number.isFinite(result.plan.dilutionRatio) ? <> (about 1:{fmt(result.plan.dilutionRatio, 2)} dilution)</> : null}.
              </div>
            ) : (
              <p style={{ marginTop: 8, color: "#64748b" }}>
                Stock concentration is below target mix concentration. You cannot reach this target by dilution alone.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="calc-card" style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Treatment-wise seeding plan</div>
          <div style={{ marginBottom: 8 }}>
            Assigned wells: <strong>{result.assignedWells}</strong> / <strong>{result.wells}</strong>
            {result.assignedWells !== result.wells ? (
              <span style={{ marginLeft: 8, color: "#64748b" }}> (Adjust group wells to match total plate wells)</span>
            ) : null}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: 8 }}>Group</th>
                  <th style={{ padding: 8 }}>Wells</th>
                  <th style={{ padding: 8 }}>Target</th>
                  <th style={{ padding: 8 }}>Per well: cells + media</th>
                  <th style={{ padding: 8 }}>Total mix</th>
                </tr>
              </thead>
              <tbody>
                {result.groups.map((g, i) => (
                  <tr key={`${g.name}-${i}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: 8 }}>{g.name}</td>
                    <td style={{ padding: 8 }}>{g.wells}</td>
                    <td style={{ padding: 8 }}>{fmt(g.target, 0)} cells/well</td>
                    <td style={{ padding: 8 }}>
                      {fmt(fromUL(g.stockPerWellUL, dispenseUnit), 2)} {dispenseUnit} + {fmt(fromUL(g.mediaPerWellUL, dispenseUnit), 2)} {dispenseUnit}
                    </td>
                    <td style={{ padding: 8 }}>
                      {fmt(fromUL(g.totalMixUL, dispenseUnit), 2)} {dispenseUnit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <CalcActions
        copyText={
          invalid || !result
            ? undefined
            : result.mode === "single"
              ? `Cell Seeding Plan\nPlate wells: ${result.wells}\nDispense/well: ${fromUL(result.vWellUL, dispenseUnit)} ${dispenseUnit}\nPer well: ${fromUL(result.plan.stockPerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} cells + ${fromUL(result.plan.mediaPerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} media`
              : `Cell Seeding (Treatment Groups)\nAssigned wells: ${result.assignedWells}/${result.wells}\n${result.groups.map((g) => `${g.name}: ${g.wells} wells, ${fromUL(g.stockPerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} cells/well`).join("\n")}`
        }
      />
    </main>
  );
}
