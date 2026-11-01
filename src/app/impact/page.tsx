import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { impactData } from "@/lib/impact-data";
import { PageTitle } from "@/components/ui";
import { ImpactClient } from "./impact-client";

export const metadata = { title: "Impact · MealBridge" };

export default function ImpactPage() {
  return (
    <>
      <PageTitle
        eyebrow="Public impact dashboard"
        title="Every meal, every mile, every dollar."
        subtitle="Live from MealBridge's own ledger and trip records, built with AG Studio. Ask the Insights agent (Gemini) anything about it."
      />
      <Suspense fallback={<div className="h-[860px] animate-pulse rounded-3xl border border-line bg-paper" />}>
        <ImpactData />
      </Suspense>
    </>
  );
}

async function ImpactData() {
  await connection();
  const { rescues, money, funds } = await impactData(getDb());
  return <ImpactClient rescues={rescues} money={money} funds={funds} />;
}
