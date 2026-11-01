import { Suspense } from "react";
import { connection } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { listings as listingsTable, matches, trips as tripsTable } from "@/db/schema";
import { cancelCompliancePlan, checkPlanPayment, subscribeCompliancePlan } from "@/app/actions";
import { allRestaurants, recentListings, tripViews } from "@/lib/queries";
import { poolBalances } from "@/services/treasury";
import { isTonight } from "@/lib/clock";
import { COMPLIANCE_PLAN_CENTS } from "@/services/subscriptions";
import { paypalMode } from "@/paypal/client";
import { Picker } from "@/components/picker";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, Money, Notice, PageTitle, RescueSteps, Skeleton, timeLabel } from "@/components/ui";
import { PostSurplusForm } from "./post-surplus-form";

export default function RestaurantPage({ searchParams }: PageProps<"/restaurant">) {
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="For restaurants" title="Post tonight's surplus" subtitle="One photo. We find the shelter, the driver and the money for the trip." />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <RestaurantView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const PLAN_NOTICE: Record<string, { tone: "leaf" | "saffron" | "berry"; text: string }> = {
  active: { tone: "leaf", text: "You're on the compliance plan. Your monthly payment now funds your own pickups first." },
  pending: { tone: "saffron", text: "PayPal is still activating your plan. It'll switch on in a minute or two." },
  cancelled: { tone: "saffron", text: "No changes made. You can join the plan any time." },
  error: { tone: "berry", text: "PayPal couldn't start the plan. Please try again." },
  busy: { tone: "saffron", text: "Too many attempts in a few minutes. Please wait a moment." },
};

async function RestaurantView({ searchParams }: { searchParams: PageProps<"/restaurant">["searchParams"] }) {
  await connection();
  const db = getDb();
  const restaurants = await allRestaurants(db);
  if (restaurants.length === 0) return <Empty>No restaurants yet. Run npm run setup to load the demo.</Empty>;

  const { r, plan } = await searchParams;
  const restaurant = restaurants.find((x) => x.id === r) ?? restaurants[0];
  const [recent, trips, pools] = await Promise.all([recentListings(db, restaurant.id), tripViews(db, { limit: 80 }), poolBalances(db)]);
  const listings = recent.filter((l) => isTonight(l.createdAt));
  const tripByListing = new Map(trips.map((t) => [t.listing.id, t]));
  const ownPool = pools.find((p) => p.restaurantId === restaurant.id);
  const [{ delivered }] = await db
    .select({ delivered: count() })
    .from(tripsTable)
    .innerJoin(matches, eq(matches.id, tripsTable.matchId))
    .innerJoin(listingsTable, eq(listingsTable.id, matches.listingId))
    .where(and(eq(listingsTable.restaurantId, restaurant.id), eq(tripsTable.status, "paid")));
  const notice = typeof plan === "string" ? PLAN_NOTICE[plan] : undefined;
  const onPlan = restaurant.plan === "compliance";

  return (
    <div className="space-y-5">
      <Picker label="Demo: you are" items={restaurants} selectedId={restaurant.id} param="r" path="/restaurant" />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="font-display text-lg font-semibold">{restaurant.name}</p>
          {onPlan ? <Badge tone="leaf">Compliance plan</Badge> : <Badge>Free</Badge>}
        </div>
        <PostSurplusForm restaurantId={restaurant.id} />
      </Card>

      <Card title="Tonight">
        {listings.length === 0 ? (
          <Empty>Nothing posted yet. Your rescues will show here, step by step.</Empty>
        ) : (
          <ul className="space-y-4">
            {listings.slice(0, 6).map((l) => {
              const trip = tripByListing.get(l.id);
              return (
                <li key={l.id} className="rounded-2xl bg-cream p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      {l.totalPortions} portions · {l.items.map((i) => i.name).join(", ")}
                    </p>
                    <span className="text-xs text-muted">{timeLabel(l.createdAt)}</span>
                  </div>
                  {trip ? (
                    <>
                      <p className="mb-3 text-sm text-muted">Going to {trip.shelter.publicLabel}{trip.driver ? ` with ${trip.driver.anonymous ? "a volunteer" : trip.driver.name}` : ""}</p>
                      <RescueSteps status={trip.trip.status} />
                    </>
                  ) : l.safetyStatus === "rejected" ? (
                    <p className="mt-1 text-sm text-berry">Not safe to rescue: {l.safetyReasons.join(" ")}</p>
                  ) : l.safetyStatus === "review" ? (
                    <p className="mt-1 text-sm text-saffron">A coordinator is checking food safety first.</p>
                  ) : (
                    <p className="mt-1 text-sm text-saffron">No shelter could take it at the time. A coordinator was alerted.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="SB 1383 compliance plan" action={onPlan && <Badge tone="leaf">{restaurant.subscriptionStatus ?? "ACTIVE"}</Badge>}>
        {onPlan ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              Your plan funds your own pickups first, and keeps the donation records California&apos;s SB 1383 asks for.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-leaf-soft p-4">
                <p className="font-display text-2xl font-semibold text-leaf">{ownPool ? <Money cents={ownPool.availableCents} /> : "$0.00"}</p>
                <p className="text-xs text-muted">left in your trip fund</p>
              </div>
              <div className="rounded-2xl bg-cream p-4">
                <p className="font-display text-2xl font-semibold">{delivered}</p>
                <p className="text-xs text-muted">recorded donations</p>
              </div>
            </div>
            {!ownPool && (
              <form action={checkPlanPayment.bind(null, restaurant.id)} className="flex flex-wrap items-center gap-3 rounded-2xl bg-saffron-soft p-4">
                <p className="flex-1 text-ink">PayPal takes your first <Money cents={COMPLIANCE_PLAN_CENTS} /> a few minutes after you approve. It shows here once it lands.</p>
                <SubmitButton variant="secondary" pendingText="Checking…">Check with PayPal</SubmitButton>
              </form>
            )}
            <div className="flex flex-wrap gap-2">
              <a href={`/api/restaurants/${restaurant.id}/records`} className="inline-flex items-center rounded-2xl bg-leaf px-4 py-2.5 font-semibold text-white">
                Download SB 1383 records (CSV)
              </a>
              <form action={cancelCompliancePlan.bind(null, restaurant.id)}>
                <SubmitButton variant="secondary" pendingText="Cancelling…">Cancel plan</SubmitButton>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              Posting stays free. For <strong className="text-ink"><Money cents={COMPLIANCE_PLAN_CENTS} /> a month</strong> your own pickups are
              funded first (no waiting for donors), and you get SB 1383 donation records ready to file.
            </p>
            <ul className="space-y-1.5">
              {["Your trips funded before anyone else's", "Records of what, when, how much and to whom", "Cancel any time from this screen"].map((f) => (
                <li key={f} className="flex gap-2"><span className="text-leaf">✓</span>{f}</li>
              ))}
            </ul>
            <form action={subscribeCompliancePlan.bind(null, restaurant.id)}>
              <SubmitButton variant="paypal" pendingText="Opening PayPal…" className="w-full py-3 text-base">
                Subscribe with PayPal
              </SubmitButton>
            </form>
            <p className="text-xs text-muted">
              {paypalMode() === "sandbox"
                ? "Opens PayPal's sandbox. Log in with a sandbox personal account to approve."
                : "PayPal is simulated here: the plan activates immediately with a test payment."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
