"use client";
import { InterpretationBlock } from "../../../lib/stats/descriptive/interpret";

export function InterpretationPanel({ blocks }: { blocks: InterpretationBlock[] }) {
  if (!blocks.length) return <div style={{ fontSize: 13 }}>No interpretation available yet.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {blocks.map((b, idx) => (
        <div key={idx} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#f9fafb" }}>
          <div style={{ fontWeight: 700 }}>{b.title}</div>
          <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>{b.detail}</div>
        </div>
      ))}
    </div>
  );
}
