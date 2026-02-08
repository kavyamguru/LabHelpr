"use client";

type Props = { copyText?: string };

export default function CalcActions(_props: Props) {
  function onReset() {
    window.location.reload();
  }

  return (
    <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button type="button" onClick={onReset}>Reset</button>
    </div>
  );
}
