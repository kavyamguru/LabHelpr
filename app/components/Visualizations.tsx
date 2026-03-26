import { ReactNode, useEffect, useMemo, useState } from "react";

interface VizItem {
  key: string;
  label: string;
  content: ReactNode;
  refElement?: React.RefObject<HTMLDivElement>;
  exportName?: string;
}

interface VisualizationsProps {
  items: VizItem[];
  showQq: boolean;
  onToggleQq: (checked: boolean) => void;
  onExportFigure: (ref: { current: HTMLDivElement | null }, filename: string, format: "png" | "svg") => void;
  helper?: string;
}

export function Visualizations({ items, showQq, onToggleQq, onExportFigure, helper }: VisualizationsProps) {
  const visibleItems = useMemo(() => items.filter((i) => i.key !== "qq" || showQq), [items, showQq]);
  const [activeKey, setActiveKey] = useState(visibleItems[0]?.key);

  useEffect(() => {
    if (!visibleItems.some((i) => i.key === activeKey)) {
      setActiveKey(visibleItems[0]?.key);
    }
  }, [activeKey, visibleItems]);

  const activeItem = visibleItems.find((i) => i.key === activeKey) || visibleItems[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveKey(item.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/40 ${
                activeKey === item.key
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-300/50 dark:bg-blue-500"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={showQq}
            onChange={(e) => onToggleQq(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
          />
          Show QQ plot (approx)
        </label>
      </div>

      {activeItem && (
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-base font-semibold text-slate-900 dark:text-slate-50">{activeItem.label}</div>
            {activeItem.refElement && activeItem.exportName && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/40"
                  onClick={() => onExportFigure(activeItem.refElement!, `${activeItem.exportName}.png`, "png")}
                >
                  Export PNG (≈300 dpi)
                </button>
                <button
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/40"
                  onClick={() => onExportFigure(activeItem.refElement!, `${activeItem.exportName}.svg`, "svg")}
                >
                  Export SVG
                </button>
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div ref={activeItem.refElement as React.RefObject<HTMLDivElement>}>{activeItem.content}</div>
          </div>
          {helper && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{helper}</p>}
        </div>
      )}
    </div>
  );
}
