"use client";
import { BioTechData } from "../../../lib/stats/descriptive/chartData";
import { Scatter } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export function BioTechPlot({ data }: { data: BioTechData }) {
  if (!data.techPoints.length && !data.bioMeans.length) return <div style={{ fontSize: 13 }}>No replicate data to plot.</div>;
  const datasets = [] as any[];
  if (data.techPoints.length) {
    datasets.push({
      label: "Technical reps",
      data: data.techPoints.map((p) => ({ x: p.group, y: p.value })),
      backgroundColor: "#6b21a8",
      pointRadius: 3,
    });
  }
  if (data.bioMeans.length) {
    datasets.push({
      label: "Biological means",
      data: data.bioMeans.map((p) => ({ x: p.group, y: p.value })),
      backgroundColor: "#2563eb",
      pointRadius: 6,
      pointStyle: "triangle",
    });
  }
  return (
    <Scatter
      data={{ datasets }}
      options={{
        responsive: true,
        plugins: { legend: { position: "top" } },
        scales: { x: { type: "category", title: { display: true, text: "Group" } }, y: { title: { display: true, text: "Response" } } },
      }}
    />
  );
}
