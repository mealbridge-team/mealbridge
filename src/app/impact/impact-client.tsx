"use client";

import dynamic from "next/dynamic";
import type { FundRow, MoneyRow, RescueRow } from "@/lib/impact-data";

// AG Studio measures the DOM and runs its data engine in the browser, so it renders client-side only.
const ImpactStudio = dynamic(() => import("./impact-studio"), {
  ssr: false,
  loading: () => <div className="h-[860px] animate-pulse rounded-2xl bg-surface" />,
});

export function ImpactClient(props: { rescues: RescueRow[]; money: MoneyRow[]; funds: FundRow[] }) {
  return <ImpactStudio {...props} />;
}
