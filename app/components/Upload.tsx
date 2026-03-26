import { ChangeEvent } from "react";

interface UploadProps {
  rawInput: string;
  onRawInputChange: (value: string) => void;
  onLoadTemplate: () => void;
  helper?: string;
  label?: string;
}

export function Upload({ rawInput, onRawInputChange, onLoadTemplate, helper, label }: UploadProps) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onRawInputChange(e.target.value);
  };

  return (
    <div className="space-y-3">
      {label && <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</label>}
      <textarea
        value={rawInput}
        onChange={handleChange}
        rows={10}
        className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 font-mono text-sm text-slate-800 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:focus:ring-blue-500/50"
        placeholder="group,bio_rep,tech_rep,value,unit"
      />
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-blue-600 dark:text-blue-300">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
          <input
            type="file"
            data-stat-upload
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            className="hidden"
          />
          ⬆️ Upload CSV
        </label>
        <button
          type="button"
          onClick={onLoadTemplate}
          className="text-slate-600 underline-offset-4 hover:text-slate-800 hover:underline dark:text-slate-300 dark:hover:text-white"
        >
          Load example template
        </button>
      </div>
      {helper && <p className="text-xs text-slate-500 dark:text-slate-400">{helper}</p>}
    </div>
  );
}
