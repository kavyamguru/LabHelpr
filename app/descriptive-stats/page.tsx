"use client";

export const dynamic = "force-dynamic";

import dynamicImport from "next/dynamic";
import Original from "./page.client";

const DescriptiveStatsPage = dynamicImport(() => Promise.resolve(Original), { ssr: false });
export default DescriptiveStatsPage;
