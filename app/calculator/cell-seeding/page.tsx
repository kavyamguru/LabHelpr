"use client";

import { useMemo, useState } from "react";
import CalcActions from "../_components/CalcActions";

type PlatePreset = "6-well" | "12-well" | "24-well" | "48-well" | "96-well" | "custom";
type VolUnit = "µL" | "mL";

type TreatmentGroup = {
  name: string;
  wells: string;
  wellIds: string;
  targetCellsPerWell: string;
};

type AdditiveMode = "percent" | "stock";
type Additive = {
  name: string;
  mode: AdditiveMode;
  percent: string;
  stockConc: string;
  targetConc: string;
  unitLabel: string;
};

const PRESETS: Record<Exclude<PlatePreset, "custom">, { wells: number; wellVolumeUL: number; rows: number; cols: number }> = {
  "6-well": { wells: 6, wellVolumeUL: 2000, rows: 2, cols: 3 },
  "12-well": { wells: 12, wellVolumeUL: 1000, rows: 3, cols: 4 },
  "24-well": { wells: 24, wellVolumeUL: 500, rows: 4, cols: 6 },
  "48-well": { wells: 48, wellVolumeUL: 300, rows: 6, cols: 8 },
  "96-well": { wells: 96, wellVolumeUL: 100, rows: 8, cols: 12 },
};

const VOL_TO_UL: Record<VolUnit, number> = { "µL": 1, mL: 1000 };

function fmt(x: number, maxFrac = 2) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

function fromUL(valueUL: number, unit: VolUnit) {
  return valueUL / VOL_TO_UL[unit];
}

function buildAllowedWellSet(rows: number, cols: number) {
  const set = new Set<string>();
  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r);
    for (let c = 1; c <= cols; c++) set.add(`${rowLabel}${c}`);
  }
  return set;
}

function parseWellToken(tokenRaw: string, allowed: Set<string>) {
  const token = tokenRaw.trim().toUpperCase();
  if (!token) return { ok: true as const, wells: [] as string[] };

  if (!token.includes("-")) {
    if (!allowed.has(token)) return { ok: false as const, error: `Invalid well: ${token}` };
    return { ok: true as const, wells: [token] };
  }

  const [start, end] = token.split("-").map((x) => x.trim().toUpperCase());
  const m1 = start.match(/^([A-Z])(\d+)$/);
  const m2 = end.match(/^([A-Z])(\d+)$/);
  if (!m1 || !m2) return { ok: false as const, error: `Invalid range: ${token}` };

  const r1 = m1[1].charCodeAt(0);
  const c1 = Number(m1[2]);
  const r2 = m2[1].charCodeAt(0);
  const c2 = Number(m2[2]);

  const wells: string[] = [];
  if (r1 === r2) {
    const [a, b] = c1 <= c2 ? [c1, c2] : [c2, c1];
    for (let c = a; c <= b; c++) wells.push(`${String.fromCharCode(r1)}${c}`);
  } else if (c1 === c2) {
    const [a, b] = r1 <= r2 ? [r1, r2] : [r2, r1];
    for (let r = a; r <= b; r++) wells.push(`${String.fromCharCode(r)}${c1}`);
  } else {
    return { ok: false as const, error: `Use same-row or same-column ranges: ${token}` };
  }

  for (const w of wells) if (!allowed.has(w)) return { ok: false as const, error: `Out-of-plate well: ${w}` };
  return { ok: true as const, wells };
}

function parseWellSelection(input: string, allowed: Set<string>) {
  const parts = input.split(/[\s,;]+/).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    const parsed = parseWellToken(p, allowed);
    if (!parsed.ok) return parsed;
    parsed.wells.forEach((w) => out.add(w));
  }
  return { ok: true as const, wells: Array.from(out).sort() };
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
  const [assignByWellIds, setAssignByWellIds] = useState(false);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [groups, setGroups] = useState<TreatmentGroup[]>([
    { name: "Treatment 1", wells: "8", wellIds: "A1-A6,B1-B2", targetCellsPerWell: "50000" },
    { name: "Treatment 2", wells: "8", wellIds: "B3-B6,C1-C4", targetCellsPerWell: "50000" },
    { name: "Treatment 3", wells: "8", wellIds: "C5-C6,D1-D6", targetCellsPerWell: "50000" },
  ]);

  const [additives, setAdditives] = useState<Additive[]>([]);

  const activePreset = preset === "custom" ? null : PRESETS[preset];

  const plateRows = activePreset?.rows ?? 0;
  const plateCols = activePreset?.cols ?? 0;
  const allowedWellSet = activePreset ? buildAllowedWellSet(activePreset.rows, activePreset.cols) : null;

  const selectedWellOwner = useMemo(() => {
    const map = new Map<string, number>();
    if (!allowedWellSet) return map;

    groups.forEach((g, gi) => {
      const parsed = parseWellSelection(g.wellIds, allowedWellSet);
      if (parsed.ok) {
        parsed.wells.forEach((w) => {
          if (!map.has(w)) map.set(w, gi);
        });
      }
    });

    return map;
  }, [groups, allowedWellSet]);

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

    const globallyAssigned = new Set<string>();

    const groupPlans = groups.map((g) => {
      const target = Number(g.targetCellsPerWell) || 0;
      if (target <= 0) return null;

      let gw = Number(g.wells) || 0;
      let resolvedWellIds = "";

      if (assignByWellIds && allowedWellSet) {
        const parsed = parseWellSelection(g.wellIds, allowedWellSet);
        if (!parsed.ok) return null;

        for (const w of parsed.wells) {
          if (globallyAssigned.has(w)) return null;
          globallyAssigned.add(w);
        }

        gw = parsed.wells.length;
        resolvedWellIds = parsed.wells.join(", ");
      }

      if (gw <= 0) return null;

      return {
        name: g.name || "Treatment",
        wells: gw,
        wellIds: resolvedWellIds,
        target,
        ...computePlanForTarget(cStock, target, gw, vWellUL, overage),
      };
    });

    if (groupPlans.some((g) => g === null)) return null;

    const validGroups = groupPlans as Array<{
      name: string;
      wells: number;
      wellIds: string;
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
      byWellIds: assignByWellIds && !!allowedWellSet,
    };
  }, [measuredCellsPerMl, wellsToSeed, dispenseVol, dispenseUnit, overagePercent, useTreatments, targetCellsPerWell, groups, assignByWellIds, preset]);

  const invalid = !result;

  const additivePlans = useMemo(() => {
    const vWellInput = Number(dispenseVol) || 0;
    const vWellUL = vWellInput * VOL_TO_UL[dispenseUnit];
    const wells = Number(wellsToSeed) || 0;
    if (vWellUL <= 0 || wells <= 0) return [];

    return additives.map((a) => {
      const name = a.name.trim() || "Substance";
      if (a.mode === "percent") {
        const pct = Number(a.percent) || 0;
        const perWellUL = (vWellUL * pct) / 100;
        return {
          name,
          mode: a.mode,
          detail: `${fmt(pct, 3)}% v/v`,
          perWellUL,
          totalUL: perWellUL * wells,
          valid: pct >= 0,
        };
      }

      const stock = Number(a.stockConc) || 0;
      const target = Number(a.targetConc) || 0;
      const perWellUL = stock > 0 ? (vWellUL * target) / stock : NaN;
      return {
        name,
        mode: a.mode,
        detail: `${fmt(target, 3)} ${a.unitLabel || "unit"} from ${fmt(stock, 3)} ${a.unitLabel || "unit"} stock`,
        perWellUL,
        totalUL: perWellUL * wells,
        valid: stock > 0 && target >= 0 && target <= stock,
      };
    });
  }, [additives, dispenseVol, dispenseUnit, wellsToSeed]);

  const validAdditivePlans = additivePlans.filter((a) => a.valid && Number.isFinite(a.perWellUL));
  const additivePerWellUL = validAdditivePlans.reduce((s, a) => s + a.perWellUL, 0);
  const additiveTotalUL = validAdditivePlans.reduce((s, a) => s + a.totalUL, 0);

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
          {useTreatments ? (
            <label>
              <input
                type="checkbox"
                checked={assignByWellIds}
                onChange={(e) => setAssignByWellIds(e.target.checked)}
                disabled={preset === "custom"}
              />{" "}
              Assign by exact well IDs ({preset === "custom" ? "requires standard plate format" : "A1, A2, B1-B3"})
            </label>
          ) : null}
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

            {assignByWellIds && activePreset ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <label style={{ width: 130 }}>Select wells for</label>
                  <select value={activeGroupIdx} onChange={(e) => setActiveGroupIdx(Number(e.target.value))}>
                    {groups.map((g, i) => (
                      <option key={i} value={i}>{g.name || `Treatment ${i + 1}`}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Click wells to assign/unassign.</span>
                </div>

                <div style={{ display: "grid", gap: 6, width: "fit-content" }}>
                  {Array.from({ length: plateRows }).map((_, r) => {
                    const rowLabel = String.fromCharCode(65 + r);
                    return (
                      <div key={rowLabel} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div style={{ width: 22, fontWeight: 700, opacity: 0.8 }}>{rowLabel}</div>
                        {Array.from({ length: plateCols }).map((__, c) => {
                          const well = `${rowLabel}${c + 1}`;
                          const owner = selectedWellOwner.get(well);
                          const isActive = owner === activeGroupIdx;
                          const isTaken = owner !== undefined && owner !== activeGroupIdx;

                          return (
                            <button
                              key={well}
                              type="button"
                              style={{
                                minWidth: 42,
                                padding: "6px 8px",
                                fontSize: 12,
                                borderRadius: 8,
                                border: "1px solid",
                                borderColor: isActive ? "#15803d" : isTaken ? "#64748b" : "#cbd5e1",
                                background: isActive ? "#dcfce7" : isTaken ? "#e2e8f0" : "#ffffff",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                const wasActive = selectedWellOwner.get(well) === activeGroupIdx;

                                setGroups((prev) => {
                                  const next = [...prev];

                                  // remove from all groups first (keeps unique ownership)
                                  for (let gi = 0; gi < next.length; gi++) {
                                    const tokens = next[gi].wellIds.split(/[\s,;]+/).filter(Boolean).map((t) => t.toUpperCase());
                                    const cleaned = tokens.filter((t) => t !== well);
                                    next[gi] = { ...next[gi], wellIds: cleaned.join(","), wells: String(cleaned.length) };
                                  }

                                  // if it was already in active group, this click unassigns it
                                  if (wasActive) return next;

                                  // otherwise assign to active group
                                  const active = next[activeGroupIdx];
                                  const activeTokens = active.wellIds.split(/[\s,;]+/).filter(Boolean).map((t) => t.toUpperCase());
                                  const finalTokens = [...activeTokens, well];
                                  next[activeGroupIdx] = {
                                    ...active,
                                    wellIds: finalTokens.join(","),
                                    wells: String(finalTokens.length),
                                  };

                                  return next;
                                });
                              }}
                            >
                              {well}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              {groups.map((g, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: assignByWellIds ? "1.1fr 1.3fr 1fr auto" : "1.2fr 0.8fr 1fr auto", gap: 8, alignItems: "center" }}>
                  <input
                    value={g.name}
                    onChange={(e) => {
                      const next = [...groups];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setGroups(next);
                    }}
                    placeholder={`Treatment ${idx + 1}`}
                  />

                  {assignByWellIds ? (
                    <input
                      type="text"
                      onFocus={(e) => e.currentTarget.select()}
                      value={g.wellIds}
                      onChange={(e) => {
                        const next = [...groups];
                        const raw = e.target.value;
                        let count = Number(next[idx].wells) || 0;
                        if (allowedWellSet) {
                          const parsed = parseWellSelection(raw, allowedWellSet);
                          if (parsed.ok) count = parsed.wells.length;
                        }
                        next[idx] = { ...next[idx], wellIds: raw, wells: String(count) };
                        setGroups(next);
                      }}
                      placeholder="e.g., A1-A6,B1-B2"
                    />
                  ) : (
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
                  )}

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
            {assignByWellIds ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>Use commas for multiple wells; ranges allowed within same row/column (e.g., A1-A6, B1, B3-B4).</div>
            ) : null}
            <button
              type="button"
              style={{ marginTop: 10 }}
              onClick={() => setGroups((prev) => [...prev, { name: `Treatment ${prev.length + 1}`, wells: "", wellIds: "", targetCellsPerWell: targetCellsPerWell || "50000" }])}
            >
              + Add treatment group
            </button>
          </section>
        )}
      </div>

      <section className="calc-card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>Additional substances per well</div>
          <button
            type="button"
            onClick={() =>
              setAdditives((prev) => [
                ...prev,
                { name: `Substance ${prev.length + 1}`, mode: "percent", percent: "", stockConc: "", targetConc: "", unitLabel: "µg/mL" },
              ])
            }
          >
            + Add substance
          </button>
        </div>

        {additives.length === 0 ? (
          <p style={{ marginTop: 8, opacity: 0.8 }}>Add cell suspension additives (e.g., antibiotic, nutrient, compound) to calculate per-well and total volumes.</p>
        ) : (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {additives.map((a, idx) => {
              const plan = additivePlans[idx];
              return (
                <div key={idx} style={{ border: "1px solid #dbe4ea", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                    <input
                      value={a.name}
                      onChange={(e) => {
                        const next = [...additives];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setAdditives(next);
                      }}
                      placeholder="Substance name"
                    />
                    <button type="button" onClick={() => setAdditives((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <label>Mode</label>
                    <select
                      value={a.mode}
                      onChange={(e) => {
                        const next = [...additives];
                        next[idx] = { ...next[idx], mode: e.target.value as AdditiveMode };
                        setAdditives(next);
                      }}
                    >
                      <option value="percent">% v/v of well volume</option>
                      <option value="stock">Target concentration from stock</option>
                    </select>

                    {a.mode === "percent" ? (
                      <>
                        <label>Percent</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onFocus={(e) => e.currentTarget.select()}
                          value={a.percent}
                          onChange={(e) => {
                            const next = [...additives];
                            next[idx] = { ...next[idx], percent: e.target.value };
                            setAdditives(next);
                          }}
                          style={{ width: 100 }}
                        />
                        <span>%</span>
                      </>
                    ) : (
                      <>
                        <label>Target</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onFocus={(e) => e.currentTarget.select()}
                          value={a.targetConc}
                          onChange={(e) => {
                            const next = [...additives];
                            next[idx] = { ...next[idx], targetConc: e.target.value };
                            setAdditives(next);
                          }}
                          style={{ width: 100 }}
                        />
                        <label>Stock</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onFocus={(e) => e.currentTarget.select()}
                          value={a.stockConc}
                          onChange={(e) => {
                            const next = [...additives];
                            next[idx] = { ...next[idx], stockConc: e.target.value };
                            setAdditives(next);
                          }}
                          style={{ width: 100 }}
                        />
                        <input
                          value={a.unitLabel}
                          onChange={(e) => {
                            const next = [...additives];
                            next[idx] = { ...next[idx], unitLabel: e.target.value };
                            setAdditives(next);
                          }}
                          placeholder="unit"
                          style={{ width: 90 }}
                        />
                      </>
                    )}
                  </div>

                  {plan ? (
                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                      {plan.valid ? (
                        <>
                          {plan.detail}: <strong>{fmt(fromUL(plan.perWellUL, dispenseUnit), 3)} {dispenseUnit}</strong> per well, total <strong>{fmt(fromUL(plan.totalUL, dispenseUnit), 3)} {dispenseUnit}</strong>.
                        </>
                      ) : (
                        <span style={{ color: "#64748b" }}>Check values for this substance (stock must be ≥ target).</span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {invalid ? (
        <p style={{ marginTop: 16, color: "#64748b" }}>Enter positive values to generate a seeding plan.</p>
      ) : result.mode === "single" ? (
        <>
          <section className="calc-card" style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Per-well volume from measured stock</div>
            <div>
              Add <strong>{fmt(fromUL(result.plan.stockPerWellUL, dispenseUnit), 2)} {dispenseUnit}</strong> cell suspension + <strong>{fmt(fromUL(additivePerWellUL, dispenseUnit), 2)} {dispenseUnit}</strong> additives + <strong>{fmt(fromUL(result.plan.mediaPerWellUL - additivePerWellUL, dispenseUnit), 2)} {dispenseUnit}</strong> base media per well.
            </div>
            {result.plan.mediaPerWellUL < 0 || result.plan.mediaPerWellUL - additivePerWellUL < 0 ? (
              <p style={{ marginTop: 8, color: "#64748b" }}>
                Total required volumes exceed selected well volume. Lower target/additives or increase dispense volume.
              </p>
            ) : null}
          </section>

          <section className="calc-card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Whole-plate seeding mix</div>
            <div>Target mix concentration: <strong>{fmt(result.plan.targetMixCellsPerMl, 0)} cells/mL</strong></div>
            <div style={{ marginTop: 4 }}>Total dispense volume: <strong>{fmt(fromUL(result.plan.totalDispenseUL, dispenseUnit), 2)} {dispenseUnit}</strong></div>
            <div style={{ marginTop: 4 }}>Total additives volume: <strong>{fmt(fromUL(additiveTotalUL, dispenseUnit), 2)} {dispenseUnit}</strong></div>
            <div style={{ marginTop: 4 }}>Prepare cell+base-media mix: <strong>{fmt(fromUL(result.plan.totalMixUL - additiveTotalUL, dispenseUnit), 2)} {dispenseUnit}</strong> ({fmt(result.plan.totalMixMl - additiveTotalUL / 1000, 3)} mL)</div>

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
                  {result.byWellIds ? <th style={{ padding: 8 }}>Well IDs</th> : null}
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
                    {result.byWellIds ? <td style={{ padding: 8, fontSize: 12 }}>{g.wellIds || "—"}</td> : null}
                    <td style={{ padding: 8 }}>{fmt(g.target, 0)} cells/well</td>
                    <td style={{ padding: 8 }}>
                      {fmt(fromUL(g.stockPerWellUL, dispenseUnit), 2)} {dispenseUnit} + {fmt(fromUL(additivePerWellUL, dispenseUnit), 2)} {dispenseUnit} additives + {fmt(fromUL(g.mediaPerWellUL - additivePerWellUL, dispenseUnit), 2)} {dispenseUnit}
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
              ? `Cell Seeding Plan\nPlate wells: ${result.wells}\nDispense/well: ${fromUL(result.vWellUL, dispenseUnit)} ${dispenseUnit}\nPer well: ${fromUL(result.plan.stockPerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} cells + ${fromUL(additivePerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} additives + ${fromUL(result.plan.mediaPerWellUL - additivePerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} base media`
              : `Cell Seeding (Treatment Groups)\nAssigned wells: ${result.assignedWells}/${result.wells}\n${result.groups.map((g) => `${g.name}: ${g.wells} wells${result.byWellIds && g.wellIds ? ` [${g.wellIds}]` : ""}, ${fromUL(g.stockPerWellUL, dispenseUnit).toFixed(2)} ${dispenseUnit} cells/well`).join("\n")}`
        }
      />
    </main>
  );
}
