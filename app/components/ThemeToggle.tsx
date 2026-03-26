"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

function applyMode(mode: Mode) {
  if (typeof window === "undefined") return;
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
    <button
      type="button"
      onClick={() => update(mode === "dark" ? "light" : "dark")}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-100 shadow-sm hover:border-slate-300 dark:hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
      aria-label="Toggle theme"
    >
      <span className="text-lg" aria-hidden>
        {mode === "dark" ? "☀️" : "🌙"}
      </span>
      <span className="hidden sm:inline">{mode === "dark" ? "Light" : "Dark"} mode</span>
    </button>
  );
}
