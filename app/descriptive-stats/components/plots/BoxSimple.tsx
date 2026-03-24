"use client";
import React from "react";

type BoxGroup = { group: string; min: number; q1: number; median: number; q3: number; max: number };

export function BoxSimple({ groups }: { groups: BoxGroup[] }) {
  if (!groups.length) return <div style={{ fontSize: 13 }}>No data.</div>;
  const globalMin = Math.min(...groups.map((g) => g.min));
  const globalMax = Math.max(...groups.map((g) => g.max));
  const span = globalMax - globalMin || 1;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {groups.map((g) => {
        const scale = (v: number) => ((v - globalMin) / span) * 100;
        return (
          <div key={g.group} style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 600 }}>{g.group}</div>
            <div style={{ position: "relative", height: 24, background: "#f3f4f6", borderRadius: 6 }}>
              <div style={{ position: "absolute", left: `${scale(g.min)}%`, width: 2, top: 4, bottom: 4, background: "#94a3b8" }} />
              <div style={{ position: "absolute", left: `${scale(g.max)}%`, width: 2, top: 4, bottom: 4, background: "#94a3b8" }} />
              <div style={{ position: "absolute", left: `${scale(g.q1)}%`, width: `${Math.max(1, scale(g.q3)-scale(g.q1))}%`, top: 4, bottom: 4, background: "#cbd5e1", border: "1px solid #94a3b8", borderRadius: 4 }} />
              <div style={{ position: "absolute", left: `${scale(g.median)}%`, width: 2, top: 0, bottom: 0, background: "#1f2937" }} />
            </div>
            <div style={{ fontSize: 12, color: "#475569" }}>Min {g.min.toFixed(2)} · Med {g.median.toFixed(2)} · Max {g.max.toFixed(2)}</div>
          </div>
        );
      })}
    </div>
  );
}
