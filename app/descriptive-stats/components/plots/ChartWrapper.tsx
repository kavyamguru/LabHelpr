"use client";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend } from "chart.js";
import { Bar, Scatter } from "react-chartjs-2";
import { ReactNode } from "react";

// Register only core Chart.js pieces (no box/violin plugins)
if (typeof window !== "undefined") {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);
}

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

// Placeholder: box/violin disabled (plugin removed)
export function BoxPlotChart({ labels }: { labels: string[] }) {
  return <div style={{ fontSize: 13 }}>Box plot temporarily disabled (plugin removed).</div>;
}

export function ViolinPlotChart({ labels }: { labels: string[] }) {
  return <div style={{ fontSize: 13 }}>Violin plot temporarily disabled (plugin removed).</div>;
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
  if (!points.length) return <div style={{ fontSize: 13 }}>Not enough data for QQ plot.</div>;
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const diagMin = Math.min(minX, minY);
  const diagMax = Math.max(maxX, maxY);
  const data = {
    datasets: [
      {
        label: "Data vs Normal",
        data: points.map((p) => ({ x: p.x, y: p.y })),
        backgroundColor: colors[2],
      },
      {
        label: "Reference (y = x)",
        data: [
          { x: diagMin, y: diagMin },
          { x: diagMax, y: diagMax },
        ],
        borderColor: "#6b7280",
        backgroundColor: "#6b7280",
        showLine: true,
        pointRadius: 0,
        borderDash: [4, 4],
      },
    ],
  };
  return (
    <Scatter
      data={data}
      options={{
        responsive: true,
        plugins: { legend: { display: true, position: "bottom" } },
        scales: { x: { type: "linear", title: { display: true, text: "Theoretical quantiles" } }, y: { title: { display: true, text: "Observed" } } },
      }}
    />
  );
}

const colors = ["#2563eb", "#9333ea", "#ea580c", "#16a34a", "#0891b2", "#dc2626"];
