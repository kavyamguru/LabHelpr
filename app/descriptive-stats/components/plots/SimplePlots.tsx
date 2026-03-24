"use client";
import { HistogramChart, StripChart, QQChart } from "./ChartWrapper";
import { HistogramData, StripData, QQData } from "../../../../lib/stats/descriptive/chartData";

export function HistogramPlot({ data }: { data: HistogramData }) {
  if (!data.series.length) return <div style={{ fontSize: 13 }}>Not enough data for histogram.</div>;
  return <HistogramChart labels={data.labels} series={data.series} />;
}

export function StripPlot({ data }: { data: StripData }) {
  if (!data.points.length) return <div style={{ fontSize: 13 }}>No points to display.</div>;
  return <StripChart points={data.points} />;
}

export function QQPlot({ data }: { data: QQData | null }) {
  if (!data) return <div style={{ fontSize: 13 }}>Not enough data for QQ plot.</div>;
  return <QQChart points={data.points} />;
}
