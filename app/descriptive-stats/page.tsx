"use client";

import dynamicImport from "next/dynamic";
import DescriptiveStatsClient from "./page.client";

export const dynamic = "force-dynamic";

const DescriptiveStatsPage = dynamicImport(async () => DescriptiveStatsClient, { ssr: false });
export default DescriptiveStatsPage;
