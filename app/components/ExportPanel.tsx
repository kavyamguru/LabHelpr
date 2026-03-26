interface ExportPanelProps {
  onReviewerReport: () => void;
  onBundleExport: () => void;
  buildingReport: boolean;
  exporting: boolean;
  units: string;
}

export function ExportPanel({ onReviewerReport, onBundleExport, buildingReport, exporting, units }: ExportPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900 dark:text-slate-50">Reviewer Mode (Markdown)</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">One-click report: dataset summary, n-integrity, policies, descriptive table, figure legend templates.</p>
          </div>
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900"
            onClick={onReviewerReport}
            disabled={buildingReport}
          >
            {buildingReport ? "Building..." : "Download"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-slate-900 dark:text-slate-50">Export Analysis Bundle (.zip)</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Raw input, cleaned data, replicate mapping, decisions, results, methods/results markdown, figures, manifest with hash metadata.</p>
            {!units.trim() && <div className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300">Set units (or "unitless") before exporting.</div>}
          </div>
          <button
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onBundleExport}
            disabled={exporting}
          >
            {exporting ? "Building..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
