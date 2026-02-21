"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

function applyMode(mode: Mode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && prefersDark);
  root.classList.toggle("dark", isDark);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("labhelpr-theme") as Mode | null) ?? "system";
  });

  useEffect(() => {
    applyMode(mode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const current = (localStorage.getItem("labhelpr-theme") as Mode | null) ?? "system";
      if (current === "system") applyMode("system");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [mode]);

  function update(next: Mode) {
    setMode(next);
    localStorage.setItem("labhelpr-theme", next);
    applyMode(next);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Theme switcher">
      <button type="button" onClick={() => update("light")} data-active={mode === "light"}>Light</button>
      <button type="button" onClick={() => update("dark")} data-active={mode === "dark"}>Dark</button>
      <button type="button" onClick={() => update("system")} data-active={mode === "system"}>System</button>
    </div>
  );
}
