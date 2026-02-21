"use client";

import { useState } from "react";

type Props = { copyText?: string };

export default function CalcActions({ copyText }: Props) {
  const [copied, setCopied] = useState(false);

  function onReset() {
    window.location.reload();
  }

  async function onCopy() {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed", err);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button type="button" onClick={onReset}>Reset</button>
      {copyText ? (
        <button type="button" onClick={onCopy}>{copied ? "Copied" : "Copy"}</button>
      ) : null}
    </div>
  );
}
