"use client";
import { ReactNode, useState } from "react";

export function MetricTooltip({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {children}
      <button
        type="button"
        aria-label={`Info about ${label}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{ marginLeft: 6, border: "none", background: "transparent", cursor: "pointer", color: "#6b7280", fontSize: 12 }}
      >
        ⓘ
      </button>
      {open && (
        <div style={{ position: "absolute", top: "120%", left: 0, background: "#111827", color: "#f9fafb", padding: 8, borderRadius: 8, maxWidth: 240, fontSize: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
          <div>{description}</div>
        </div>
      )}
    </span>
  );
}
