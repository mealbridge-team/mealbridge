import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db";
import { tripViews } from "@/lib/queries";
import { paypalMode } from "@/paypal/client";
import { poolBalances } from "@/services/treasury";
import { AREA_LABEL, buttonClass, Container, Empty, Money, PageHeader, Panel, Skeleton, smallButton } from "@/components/ui";
import { DonateForm } from "./donate-form";

export const metadata = { title: "Donate" };

export default function DonatePage({ searchParams }: PageProps<"/donate">) {
  return (
    <Container size="app">
      <PageHeader
        kicker="Donate"
        title="Fund a rescue tonight"
        description="Every dollar reimburses a volunteer driver's fuel for a delivery you can see on the impact dashboard. Nothing goes to overhead."
      />
      <Suspense fallback={<div className="py-8"><Skeleton lines={6} /></div>}>
        <DonateView searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function DonateView({ searchParams }: { searchParams: PageProps<"/donate">["searchParams"] }) {
  await connection();
  const db = getDb();
  const [pools, waiting] = await Promise.all([poolBalances(db), tripViews(db, { statuses: ["unfunded"] })]);
  const funds = pools.filter((p) => p.kind === "donor_area" || p.kind === "general");
  if (funds.length === 0) return <Empty>No funds set up yet. Run npm run setup to load the demo.</Empty>;

  const { trip } = await searchParams;
  const chosen = waiting.find((w) => w.trip.id === trip);
  const areaFund = chosen && funds.find((f) => f.kind === "donor_area" && f.area === chosen.restaurant.area);

  return (
    <div className="grid items-start gap-6 py-8 lg:grid-cols-[1.4fr_1fr]">
      <Panel
        title={chosen ? `Fund the ${chosen.restaurant.name} pickup` : "Give to a rescue fund"}
        description={chosen ? `${chosen.listing.totalPortions} portions waiting for a driver in ${AREA_LABEL[chosen.restaurant.area]}. Your gift sends one now.` : undefined}
      >
        <DonateForm
          key={chosen?.trip.id ?? "general"}
          funds={funds.map((f) => ({ id: f.id, label: f.label }))}
          initialFundId={areaFund?.id ?? funds[0].id}
          tripId={chosen?.trip.id}
          tripAmountCents={chosen?.trip.stipendCents}
          mode={paypalMode()}
        />
      </Panel>

      <div className="space-y-6">
        <Panel title="Waiting for funding" description={waiting.length ? "These pickups go as soon as they're covered." : undefined}>
          {waiting.length === 0 ? (
            <Empty>Every pickup tonight is funded. Thank you.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {waiting.map((w) => (
                <li key={w.trip.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm">
                    {w.listing.totalPortions} portions in {AREA_LABEL[w.restaurant.area]}
                    <span className="block text-xs text-muted">
                      needs <Money cents={w.trip.stipendCents} />
                    </span>
                  </span>
                  <Link href={`/donate?trip=${w.trip.id}`} className={`${w.trip.id === chosen?.trip.id ? buttonClass.primary : buttonClass.secondary} ${smallButton}`}>
                    {w.trip.id === chosen?.trip.id ? "Selected" : "Fund this"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Funds right now">
          <ul className="divide-y divide-line text-sm">
            {funds.map((f) => (
              <li key={f.id} className="flex justify-between gap-3 py-2.5">
                <span>{f.label}</span>
                <Money cents={f.availableCents} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
