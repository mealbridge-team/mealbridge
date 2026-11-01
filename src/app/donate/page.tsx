import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { tripViews } from "@/lib/queries";
import { paypalMode } from "@/paypal/client";
import { poolBalances } from "@/services/treasury";
import { AREA_LABEL, Card, Empty, Money, PageTitle, Skeleton } from "@/components/ui";
import { DonateForm } from "./donate-form";
import Link from "next/link";

export default function DonatePage({ searchParams }: PageProps<"/donate">) {
  return (
    <>
      <PageTitle title="Sponsor a rescue" subtitle="Every dollar is tied to a delivery you can see. Drivers are reimbursed from it the moment food arrives." />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <DonateView searchParams={searchParams} />
      </Suspense>
    </>
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
    <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
      <Card title={chosen ? `Fund the ${chosen.restaurant.name} pickup` : "Give to a rescue fund"}>
        <DonateForm
          key={chosen?.trip.id ?? "general"}
          funds={funds.map((f) => ({ id: f.id, label: f.label }))}
          initialFundId={areaFund?.id ?? funds[0].id}
          tripId={chosen?.trip.id}
          mode={paypalMode()}
        />
      </Card>

      <div className="space-y-5">
        <Card title="Waiting for funding">
          {waiting.length === 0 ? (
            <Empty>Every pickup tonight is funded. Thank you!</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {waiting.map((w) => (
                <li key={w.trip.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <span>
                    {w.listing.totalPortions} portions in {AREA_LABEL[w.restaurant.area]} · <Money cents={w.trip.stipendCents} />
                  </span>
                  <Link href={`/donate?trip=${w.trip.id}`} className="rounded-full bg-leaf px-3 py-1 text-xs font-semibold text-white">
                    Fund this
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Funds right now">
          <ul className="divide-y divide-line text-sm">
            {funds.map((f) => (
              <li key={f.id} className="flex justify-between py-2">
                <span>{f.label}</span>
                <Money cents={f.availableCents} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
