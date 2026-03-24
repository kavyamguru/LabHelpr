"use client";
import { BoxPlotChart, ChartContainer, ViolinPlotChart } from "./ChartWrapper";
import { BoxLikeData, ViolinData } from "../../../lib/stats/descriptive/chartData";

export function BoxPlot({ data }: { data: BoxLikeData }) {
  if (!data.labels.length) return <div style={{ fontSize: 13 }}>Not enough data for box plot.</div>;
  return (
    <ChartContainer>
      <BoxPlotChart labels={data.labels} quartiles={data.quartiles} />
    </ChartContainer>
  );
}

export function ViolinPlot({ data }: { data: ViolinData }) {
  if (!data.labels.length) return <div style={{ fontSize: 13 }}>Not enough data for violin plot.</div>;
  return (
    <ChartContainer>
      <ViolinPlotChart labels={data.labels} violins={data.violins} />
    </ChartContainer>
  );
}
