type RawRow = {
  rowId: number;
  group: string;
  bioRep?: string;
  techRep?: string;
  value?: number;
  unit?: string;
  rawValue: string;
  issues: string[];
};

interface DataPreviewProps {
  usable: RawRow[];
  removed: RawRow[];
}

export function DataPreview({ usable, removed }: DataPreviewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-50">Usable rows</div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{usable.length} row(s) retained • {removed.length} removed due to missing/invalid values.</p>
        <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Bio rep</th>
                <th className="px-3 py-2">Tech rep</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Unit</th>
              </tr>
            </thead>
            <tbody>
              {usable.slice(0, 60).map((row) => (
                <tr key={row.rowId} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-1.5">{row.group}</td>
                  <td className="px-3 py-1.5">{row.bioRep || "—"}</td>
                  <td className="px-3 py-1.5">{row.techRep || "—"}</td>
                  <td className="px-3 py-1.5">{row.value}</td>
                  <td className="px-3 py-1.5">{row.unit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {usable.length > 60 && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Showing first 60 rows.</p>}
      </div>

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30">
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">Removed / flagged</div>
        {removed.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-green-700 dark:text-green-300">No rows removed.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
            {removed.slice(0, 30).map((r) => (
              <li key={r.rowId}>Row {r.rowId + 1}: {r.issues.join("; ")}</li>
            ))}
          </ul>
        )}
        {removed.length > 30 && <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Showing first 30 removed rows.</p>}
      </div>
    </div>
  );
}
