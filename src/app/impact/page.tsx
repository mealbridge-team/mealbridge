import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { impactData } from "@/lib/impact-data";
import { Container, PageHeader } from "@/components/ui";
import { ImpactClient } from "./impact-client";

export const metadata = { title: "Impact" };

export default function ImpactPage() {
  return (
    <Container>
      <PageHeader
        kicker="Public impact dashboard"
        title="Every meal, every mile, every dollar."
        description="Live from MealBridge's own ledger and trip records, built with AG Studio. Ask the Insights agent anything about it."
      />
      <div className="py-8">
        <Suspense fallback={<div className="h-[860px] animate-pulse rounded-2xl bg-surface" />}>
          <ImpactData />
        </Suspense>
      </div>
    </Container>
  );
}

async function ImpactData() {
  await connection();
  const { rescues, money, funds } = await impactData(getDb());
  return <ImpactClient rescues={rescues} money={money} funds={funds} />;
}
