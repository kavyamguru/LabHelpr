import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  CategoryScale,
} from "chart.js";
import { GroupStats } from "../..//lib/stats/descriptive";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, CategoryScale);

function inverseNormal(p: number) {
  const a1 = -39.6968302866538;
  const a2 = 220.946098424521;
  const a3 = -275.928510446969;
  const a4 = 138.357751867269;
  const a5 = -30.6647980661472;
  const a6 = 2.50662827745924;

  const b1 = -54.4760987982241;
  const b2 = 161.585836858041;
  const b3 = -155.698979859887;
  const b4 = 66.8013118877197;
  const b5 = -13.2806815528857;

  const c1 = -7.78489400243029e-03;
  const c2 = -0.322396458041136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;

  const d1 = 7.78469570904146e-03;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  const plow = 0.02425;
  const phigh = 1 - plow;
  let q = 0;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  if (phigh < p) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  q = p - 0.5;
  const r = q * q;
  return (
    (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
}

export function QqPlot({ stats }: { stats: GroupStats[] }) {
  if (stats.length === 0) return <div className="empty">No data</div>;

  const datasets = stats.map((g, idx) => {
    const sorted = [...g.valuesUsed].sort((a, b) => a - b);
    const n = sorted.length;
    const points = sorted.map((v, i) => {
      const p = (i + 0.5) / n;
      const theo = inverseNormal(p);
      return { x: theo, y: v };
    });
    return {
      label: g.group,
      data: points,
      borderColor: palette[idx % palette.length],
      backgroundColor: palette[idx % palette.length],
      showLine: false,
      pointRadius: 3,
    };
  });

  const data = { datasets };
  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      tooltip: { mode: "nearest" as const, intersect: true },
    },
    scales: {
      x: { title: { display: true, text: "Theoretical quantiles (normal)" } },
      y: { title: { display: true, text: "Observed quantiles" } },
    },
  };
  return <Scatter data={data} options={options} height={260} />;
}

const palette = ["#1d4ed8", "#10b981", "#f97316", "#9333ea", "#ef4444", "#0ea5e9", "#f59e0b"];
