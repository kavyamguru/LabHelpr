"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type PlatePreset = "6-well" | "12-well" | "24-well" | "48-well" | "96-well" | "custom";

const PRESETS: Record<Exclude<PlatePreset, "custom">, { wells: number; wellVolumeUL: number }> = {
  "6-well": { wells: 6, wellVolumeUL: 2000 },
  "12-well": { wells: 12, wellVolumeUL: 1000 },
  "24-well": { wells: 24, wellVolumeUL: 500 },
  "48-well": { wells: 48, wellVolumeUL: 300 },
  "96-well": { wells: 96, wellVolumeUL: 100 },
};

function fmt(x: number, maxFrac = 2) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export default function CellSeedingPage() {
  const [preset, setPreset] = useState<PlatePreset>("24-well");
  const [wellsToSeed, setWellsToSeed] = useState<number>(24);
  const [dispenseUL, setDispenseUL] = useState<number>(500);

  const [measuredCellsPerMl, setMeasuredCellsPerMl] = useState<number>(1_000_000);
  const [targetCellsPerWell, setTargetCellsPerWell] = useState<number>(50_000);
  const [overagePercent, setOveragePercent] = useState<number>(10);

  const activePreset = preset === "custom" ? null : PRESETS[preset];

  const result = useMemo(() => {
    const Cstock = Number(measuredCellsPerMl) || 0; // cells/mL
    const targetCells = Number(targetCellsPerWell) || 0; // cells/well
    const wells = Number(wellsToSeed) || 0;
    const VwellUL = Number(dispenseUL) || 0;
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
  }, [measuredCellsPerMl, targetCellsPerWell, wellsToSeed, dispenseUL, overagePercent]);

  const invalid = !result;

  return (
    <main className="calc-page">
      <h1>Mammalian Cell Seeding</h1>
      <p style={{ opacity: 0.85 }}>
        User-requested feature for mammalian tissue-culture workflows: enter your measured cells/mL and target cells/well,
        then get clear per-well seeding volume and full-plate dilution/mix instructions for common plate formats.
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
                setWellsToSeed(PRESETS[next].wells);
                setDispenseUL(PRESETS[next].wellVolumeUL);
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
          <input type="number" onFocus={(e) => e.currentTarget.select()} value={wellsToSeed} onChange={(e) => setWellsToSeed(Number(e.target.value))} style={{ width: 160 }} />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Dispense volume per well</label>
          <input type="number" onFocus={(e) => e.currentTarget.select()} value={dispenseUL} onChange={(e) => setDispenseUL(Number(e.target.value))} style={{ width: 160 }} />
          <span>µL</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Measured cell concentration</label>
          <input type="number" onFocus={(e) => e.currentTarget.select()} value={measuredCellsPerMl} onChange={(e) => setMeasuredCellsPerMl(Number(e.target.value))} style={{ width: 200 }} />
          <span>cells/mL</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Target seeding density</label>
          <input type="number" onFocus={(e) => e.currentTarget.select()} value={targetCellsPerWell} onChange={(e) => setTargetCellsPerWell(Number(e.target.value))} style={{ width: 200 }} />
          <span>cells/well</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ width: 230 }}>Extra mix (dead volume)</label>
          <input type="number" onFocus={(e) => e.currentTarget.select()} value={overagePercent} onChange={(e) => setOveragePercent(Number(e.target.value))} style={{ width: 120 }} />
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
              Add <strong>{fmt(result.stockPerWellUL, 2)} µL</strong> cell suspension + <strong>{fmt(result.mediaPerWellUL, 2)} µL</strong> media per well.
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
            <div style={{ marginTop: 4 }}>Total dispense volume: <strong>{fmt(result.totalDispenseUL, 0)} µL</strong></div>
            <div style={{ marginTop: 4 }}>Prepare total mix: <strong>{fmt(result.totalMixUL, 0)} µL</strong> ({fmt(result.totalMixMl, 3)} mL, includes {fmt(overagePercent, 1)}% extra)</div>

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
            : `Cell Seeding Plan\nPlate wells: ${result.wells}\nDispense/well: ${result.VwellUL} µL\nPer well: ${result.stockPerWellUL.toFixed(2)} µL cells + ${result.mediaPerWellUL.toFixed(2)} µL media\nTotal mix: ${result.totalMixUL.toFixed(0)} µL\nTarget mix conc: ${result.targetMixCellsPerMl.toFixed(0)} cells/mL`
        }
      />
    </main>
  );
}
