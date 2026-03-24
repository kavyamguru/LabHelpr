"use client";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend } from "chart.js";
import { BoxPlot, Violin, BoxAndWhiskers, ArrayLinearScale, ArrayLogarithmicScale, HorizontalBoxPlot, HorizontalViolin } from "chartjs-chart-box-and-violin-plot";
import { Bar, Scatter, Chart as ReactChart } from "react-chartjs-2";
import { ReactNode } from "react";

ChartJS.register(CategoryScale, LinearScale, ArrayLinearScale as any, ArrayLogarithmicScale as any, PointElement, LineElement, BarElement, Tooltip, Legend, BoxPlot as any, BoxAndWhiskers as any, Violin as any, HorizontalBoxPlot as any, HorizontalViolin as any);

export function ChartContainer({ children }: { children: ReactNode }) {
  return <div style={{ width: "100%", maxWidth: "100%" }}>{children}</div>;
}

export function HistogramChart({ labels, series }: { labels: string[]; series: { label: string; data: number[] }[] }) {
  const data = {
    labels,
    datasets: series.map((s, idx) => ({
      label: s.label,
      data: s.data,
      backgroundColor: colors[idx % colors.length] + "99",
      borderColor: colors[idx % colors.length],
      borderWidth: 1,
    })),
  };
  return <Bar data={data} options={{ responsive: true, plugins: { legend: { position: "top" } }, scales: { x: { stacked: true }, y: { beginAtZero: true, stacked: true } } }} />;
}

export function BoxPlotChart({ labels, quartiles }: { labels: string[]; quartiles: { min: number; q1: number; median: number; q3: number; max: number; outliers: number[] }[] }) {
  const data = {
    labels,
    datasets: [
      {
        label: "",
        outlierColor: "#dc2626",
        padding: 10,
        itemRadius: 0,
        borderColor: colors[0],
        backgroundColor: colors[0] + "44",
        data: quartiles.map((q) => ({
          min: q.min,
          q1: q.q1,
          median: q.median,
          q3: q.q3,
          max: q.max,
          outliers: q.outliers,
        })),
      },
    ],
  };
  return (
    <Bar
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { x: { }, y: { title: { display: true, text: "Response" } } },
      }}
    />
  );
}

export function ViolinPlotChart({ labels, violins }: { labels: string[]; violins: { values: number[] }[] }) {
  const data = {
    labels,
    datasets: [
      {
        label: "",
        borderColor: colors[1],
        backgroundColor: colors[1] + "33",
        data: violins.map((v) => ({ values: v.values })),
      },
    ],
  };
  return (
    <ReactChart
      type={"violin" as any}
      data={data}
      options={{
        indexAxis: "x",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { x: {}, y: { title: { display: true, text: "Response" } } },
      }}
    />
  );
}

export function StripChart({ points }: { points: { x: string; y: number; outlier?: boolean }[] }) {
  const data = {
    datasets: [
      {
        label: "Values",
        data: points.filter((p) => !p.outlier).map((p) => ({ x: p.x, y: p.y, r: 4 })),
        backgroundColor: colors[1] + "aa",
      },
      {
        label: "Outliers",
        data: points.filter((p) => p.outlier).map((p) => ({ x: p.x, y: p.y, r: 5 })),
        backgroundColor: "#dc2626",
      },
    ],
  };
  return (
    <Scatter
      data={data}
      options={{ responsive: true, animation: false, plugins: { legend: { position: "top" } }, scales: { x: { type: "category" }, y: { type: "linear" } } }}
    />
  );
}

export function QQChart({ points }: { points: { x: number; y: number }[] }) {
  const data = {
    datasets: [
      {
        label: "Data vs Normal",
        data: points.map((p) => ({ x: p.x, y: p.y })),
        backgroundColor: colors[2],
      },
    ],
  };
  return (
    <Scatter
      data={data}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { type: "linear", title: { display: true, text: "Theoretical quantiles" } }, y: { title: { display: true, text: "Observed" } } },
      }}
    />
  );
}

const colors = ["#2563eb", "#9333ea", "#ea580c", "#16a34a", "#0891b2", "#dc2626"];
