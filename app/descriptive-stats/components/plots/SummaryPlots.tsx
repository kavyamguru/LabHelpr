"use client";
import { BoxPlotChart, ViolinPlotChart } from "./ChartWrapper";

export function BoxPlot({ data }: { data: any }) {
  return <BoxPlotChart labels={data?.labels ?? []} />;
}

export function ViolinPlot({ data }: { data: any }) {
  return <ViolinPlotChart labels={data?.labels ?? []} />;
}
