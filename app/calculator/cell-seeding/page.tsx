"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type PlatePreset = "6-well" | "12-well" | "24-well" | "48-well" | "96-well" | "custom";
type VolUnit = "µL" | "mL";

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

export default function CellSeedingPage() {
  const [preset, setPreset] = useState<PlatePreset>("24-well");
  const [wellsToSeed, setWellsToSeed] = useState<string>("24");
  const [dispenseVol, setDispenseVol] = useState<string>("500");
  const [dispenseUnit, setDispenseUnit] = useState<VolUnit>("µL");

  const [measuredCellsPerMl, setMeasuredCellsPerMl] = useState<string>("1000000");
  const [targetCellsPerWell, setTargetCellsPerWell] = useState<string>("50000");
  const [overagePercent, setOveragePercent] = useState<string>("10");

  const activePreset = preset === "custom" ? null : PRESETS[preset];

  const result = useMemo(() => {
    const Cstock = Number(measuredCellsPerMl) || 0; // cells/mL
    const targetCells = Number(targetCellsPerWell) || 0; // cells/well
    const wells = Number(wellsToSeed) || 0;
    const VwellInput = Number(dispenseVol) || 0;
    const VwellUL = VwellInput * VOL_TO_UL[dispenseUnit];
    const overage = Math.max(0, Number(overagePercent) || 0) / 100;

    if (Cstock <= 0 || targetCells <= 0 || wells <= 0 || VwellUL <= 0) return null;

    const VwellMl = VwellUL / 1000;

    // Mode A: direct stock use per well
    const stockPerWellMl = targetCells / Cstock;
    const stockPerWellUL = stockPerWellMl * 1000;
    const mediaPerWellUL = VwellUL - stockPerWellUL;

    // Mode B: diluted seeding mix for whole run
    const targetMixCellsPerMl = targetCells / VwellMl;
    const totalDispenseUL = wells * VwellUL;
    const totalMixUL = totalDispenseUL * (1 + overage);
    const totalMixMl = totalMixUL / 1000;

    let stockForMixMl = NaN;
    let diluentForMixMl = NaN;
    let dilutionRatio = NaN;

    if (Cstock >= targetMixCellsPerMl) {
      stockForMixMl = (targetMixCellsPerMl * totalMixMl) / Cstock;
      diluentForMixMl = totalMixMl - stockForMixMl;
      dilutionRatio = Cstock / targetMixCellsPerMl; // 1:X
    }

    return {
      VwellUL,
      wells,
      Cstock,
      targetCells,
      stockPerWellUL,
      mediaPerWellUL,
      targetMixCellsPerMl,
      totalDispenseUL,
      totalMixUL,
      totalMixMl,
      stockForMixMl,
      diluentForMixMl,
      dilutionRatio,
      canDilute: Cstock >= targetMixCellsPerMl,
    };
  }, [measuredCellsPerMl, targetCellsPerWell, wellsToSeed, dispenseVol, dispenseUnit, overagePercent]);

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
          <label style={{ width: 230 }}>Target seeding density</label>
          <input type="text" inputMode="decimal" onFocus={(e) => e.currentTarget.select()} value={targetCellsPerWell} onChange={(e) => setTargetCellsPerWell(e.target.value)} style={{ width: 200 }} />
          <span>cells/well</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Extra mix (dead volume)</label>
          <input type="text" inputMode="decimal" onFocus={(e) => e.currentTarget.select()} value={overagePercent} onChange={(e) => setOveragePercent(e.target.value)} style={{ width: 120 }} />
          <span>%</span>
        </div>
      </div>

      {invalid ? (
        <p style={{ marginTop: 16, color: "#64748b" }}>Enter positive values to generate a seeding plan.</p>
      ) : (
        <>
          <section className="calc-card" style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Per-well volume from measured stock</div>
            <div>
              Add <strong>{fmt(fromUL(result.stockPerWellUL, dispenseUnit), 2)} {dispenseUnit}</strong> cell suspension + <strong>{fmt(fromUL(result.mediaPerWellUL, dispenseUnit), 2)} {dispenseUnit}</strong> media per well.
            </div>
            {result.mediaPerWellUL < 0 ? (
              <p style={{ marginTop: 8, color: "#64748b" }}>
                Target is too high for this stock at selected well volume. Concentrate cells or increase dispense volume.
              </p>
            ) : null}
          </section>

          <section className="calc-card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Whole-plate seeding mix</div>
            <div>Target mix concentration: <strong>{fmt(result.targetMixCellsPerMl, 0)} cells/mL</strong></div>
            <div style={{ marginTop: 4 }}>Total dispense volume: <strong>{fmt(fromUL(result.totalDispenseUL, dispenseUnit), 2)} {dispenseUnit}</strong></div>
            <div style={{ marginTop: 4 }}>Prepare total mix: <strong>{fmt(fromUL(result.totalMixUL, dispenseUnit), 2)} {dispenseUnit}</strong> ({fmt(result.totalMixMl, 3)} mL, includes {fmt(Number(overagePercent) || 0, 1)}% extra)</div>

            {result.canDilute ? (
              <div style={{ marginTop: 8 }}>
                Mix <strong>{fmt(result.stockForMixMl, 3)} mL</strong> cell stock + <strong>{fmt(result.diluentForMixMl, 3)} mL</strong> media
                {Number.isFinite(result.dilutionRatio) ? <> (about 1:{fmt(result.dilutionRatio, 2)} dilution)</> : null}.
              </div>
            ) : (
              <p style={{ marginTop: 8, color: "#64748b" }}>
                Stock concentration is below target mix concentration. You cannot reach this target by dilution alone.
              </p>
            )}
          </section>
        </>
      )}

      <CalcActions
        copyText={
          invalid || !result
            ? undefined
            : `Cell Seeding Plan\nPlate wells: ${result.wells}\nDispense/well: ${fromUL(result.VwellUL, dispenseUnit)} ${dispenseUnit}\nPer well: ${fromUL(result.stockPerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} cells + ${fromUL(result.mediaPerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} media\nTotal mix: ${fromUL(result.totalMixUL, dispenseUnit).toFixed(2)} ${dispenseUnit}\nTarget mix conc: ${result.targetMixCellsPerMl.toFixed(0)} cells/mL`
        }
      />
    </main>
  );
}
