import { GroupStats, VarianceConvention } from "../../lib/stats/descriptive";

type StatRowProps = { label: string; value: string; tooltip?: string };
const StatRow = ({ label, value, tooltip }: StatRowProps) => (
  <div className="flex items-start justify-between gap-2" title={tooltip}>
    <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
    <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</span>
  </div>
);

interface StatSummaryProps {
  stats: GroupStats[];
  showModes: boolean;
  onToggleModes: (checked: boolean) => void;
  format: (n: number | null | undefined, sigOverride?: number) => string;
  varianceConvention: VarianceConvention;
}

export function StatSummary({ stats, showModes, onToggleModes, format, varianceConvention }: StatSummaryProps) {
  if (stats.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">Add data and ensure replicate declaration to compute stats.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((g) => (
          <div
            key={g.group}
            className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900 dark:text-slate-50">{g.group}</div>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200">n (bio) = {g.nBio}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatRow label="Mean" value={format(g.mean)} />
              <StatRow label="Median" value={format(g.median)} />
              {showModes && <StatRow label="Mode(s)" value={g.modes.length ? g.modes.map((m) => format(m)).join(", ") : "—"} />}
              <StatRow label="SD" value={format(g.sd)} tooltip={`Standard deviation (${varianceConvention === "sample" ? "sample" : "population"})`} />
              <StatRow label="Variance" value={format(g.variance)} />
              <StatRow label="SEM" value={format(g.sem)} tooltip="Standard error of the mean (SD/√n_bio)" />
              <StatRow label="CV%" value={format(g.cv)} tooltip="Coefficient of variation" />
              <StatRow label="Min" value={format(g.min)} />
              <StatRow label="Max" value={format(g.max)} />
              <StatRow label="Range" value={format(g.range)} />
              <StatRow
                label="Normality hint"
                value={g.normality.w ? `${g.normality.label} · W=${format(g.normality.w)}` : "Not reliable (n<3)"}
                tooltip="Heuristic; not inferential."
              />
              <StatRow
                label="IQR outliers"
                value={g.iqrFlags.count === 0 ? "0 flagged" : `${g.iqrFlags.count} flagged (never removed)`}
                tooltip={`Outliers flagged using ${g.iqrMultiplier}×IQR fences; not removed`}
              />
              {g.ci95 && (
                <StatRow
                  label="95% CI (t-based)"
                  value={`${format(g.ci95.low)} to ${format(g.ci95.high)} (df=${g.ci95.df})`}
                  tooltip="t-based CI: mean ± t*SEM"
                />
              )}
            </div>
            {!showModes && g.modes.length > 1 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Multiple modes detected; toggle below to display.</p>
            )}
          </div>
        ))}
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={showModes}
          onChange={(e) => onToggleModes(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
        />
        Show mode(s) when multimodal (hidden by default)
      </label>
    </div>
  );
}
