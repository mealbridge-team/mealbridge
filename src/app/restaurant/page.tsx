import { Suspense } from "react";
import { connection } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { Check, Download } from "lucide-react";
import { getDb } from "@/db";
import { listings as listingsTable, matches, trips as tripsTable } from "@/db/schema";
import { cancelCompliancePlan, subscribeCompliancePlan } from "@/app/actions";
import { allRestaurants, recentListings, tripViews } from "@/lib/queries";
import { poolBalances } from "@/services/treasury";
import { isTonight } from "@/lib/clock";
import { COMPLIANCE_PLAN_CENTS } from "@/services/subscriptions";
import { paypalMode } from "@/paypal/client";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/submit-button";
import { Badge, buttonClass, Container, Empty, Money, Notice, PageHeader, Panel, RescueSteps, Skeleton, smallButton, timeLabel, type Tone } from "@/components/ui";
import { PageArt } from "@/components/page-art";
import { personaId } from "@/lib/demo-session";
import { PortalSignIn } from "@/app/demo/people";
import { PostSurplusForm } from "./post-surplus-form";

export const metadata = { title: "For restaurants" };

export default function RestaurantPage({ searchParams }: PageProps<"/restaurant">) {
  return (
    <Container size="app">
      <Suspense
        fallback={
          <>
            <PageHeader art={<PageArt page="restaurant" />} kicker="For restaurants" title="Post tonight's surplus" />
            <div className="py-8">
              <Skeleton lines={6} />
            </div>
          </>
        }
      >
        <RestaurantView searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

const PLAN_NOTICE: Record<string, { tone: Tone; text: string }> = {
  active: { tone: "ok", text: "You're on the compliance plan. Your monthly payment now funds your own pickups first." },
  pending: { tone: "warn", text: "PayPal is still activating your plan. It switches on in a minute or two." },
  cancelled: { tone: "neutral", text: "No changes made. You can join the plan any time." },
  error: { tone: "bad", text: "PayPal couldn't start the plan. Please try again." },
  busy: { tone: "warn", text: "Too many attempts in a few minutes. Please wait a moment." },
};

async function RestaurantView({ searchParams }: { searchParams: PageProps<"/restaurant">["searchParams"] }) {
  await connection();
  const db = getDb();
  const restaurants = await allRestaurants(db);
  if (restaurants.length === 0) return <Empty>No restaurants yet. Run npm run setup to load the demo.</Empty>;

  const { r, plan } = await searchParams;
  // PayPal's subscription return names the restaurant in the URL; otherwise it's whoever is signed in.
  const signedIn = typeof r === "string" ? r : await personaId("restaurant");
  const restaurant = restaurants.find((x) => x.id === signedIn);
  if (!restaurant)
    return <PortalSignIn role="restaurant" header={<PageHeader art={<PageArt page="restaurant" />} kicker="For restaurants" title="Sign in to your restaurant" description="Choose a restaurant to post tonight's surplus as." />} />;
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
  const awaitingFirstPayment = onPlan && !ownPool;
  const inFlight = listings.some((l) => {
    const status = tripByListing.get(l.id)?.trip.status;
    return status && !["paid", "cancelled"].includes(status);
  });

  return (
    <>
      <PageHeader art={<PageArt page="restaurant" />} kicker="For restaurants" title="Post tonight's surplus" description="One photo or a short note. We find the shelter, the driver and the money for the trip." />

      <div className="grid items-start gap-6 py-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          <Panel title={restaurant.name} action={onPlan ? <Badge tone="ok">Compliance plan</Badge> : <Badge>Free</Badge>}>
            <PostSurplusForm restaurantId={restaurant.id} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Tonight" description="Each rescue, step by step.">
            {listings.length === 0 ? (
              <Empty>Nothing posted yet tonight.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {listings.slice(0, 6).map((l) => {
                  const trip = tripByListing.get(l.id);
                  return (
                    <li key={l.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium">
                          {l.totalPortions} portions · {l.items.map((i) => i.name).join(", ")}
                        </p>
                        <span className="shrink-0 text-xs text-muted">{timeLabel(l.createdAt)}</span>
                      </div>
                      {trip ? (
                        <>
                          <p className="text-sm text-muted">
                            To {trip.shelter.publicLabel}
                            {trip.driver ? ` with ${trip.driver.anonymous ? "a volunteer" : trip.driver.name}` : ""}
                          </p>
                          <RescueSteps status={trip.trip.status} />
                        </>
                      ) : l.safetyStatus === "rejected" ? (
                        <p className="text-sm text-bad">Not safe to rescue: {l.safetyReasons.join(" ")}</p>
                      ) : l.safetyStatus === "review" ? (
                        <p className="text-sm text-warn">A coordinator is checking food safety first.</p>
                      ) : (
                        <p className="text-sm text-warn">No shelter could take it at the time. A coordinator was alerted.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="SB 1383 compliance plan" action={onPlan && <Badge tone="ok">{(restaurant.subscriptionStatus ?? "Active").toLowerCase()}</Badge>}>
            {onPlan ? (
              <div className="space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
                  <div className="bg-bg p-4">
                    <p className="font-display text-2xl font-semibold tabular-nums">{ownPool ? <Money cents={ownPool.availableCents} /> : "$0.00"}</p>
                    <p className="text-xs text-muted">left in your trip fund</p>
                  </div>
                  <div className="bg-bg p-4">
                    <p className="font-display text-2xl font-semibold tabular-nums">{delivered}</p>
                    <p className="text-xs text-muted">recorded donations</p>
                  </div>
                </div>
                {awaitingFirstPayment && (
                  <Notice tone="warn">
                    PayPal takes your first <Money cents={COMPLIANCE_PLAN_CENTS} /> a few minutes after you approve. This updates by itself once it lands.
                  </Notice>
                )}
                <div className="flex flex-wrap gap-2">
                  <a href={`/api/restaurants/${restaurant.id}/records`} className={buttonClass.secondary}>
                    <Download className="h-4 w-4" aria-hidden /> SB 1383 records (CSV)
                  </a>
                  <form action={cancelCompliancePlan.bind(null, restaurant.id)}>
                    <SubmitButton variant="ghost" pendingText="Cancelling…" className={`${smallButton} text-muted`} confirm="Cancel your compliance plan with PayPal?">
                      Cancel plan
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <p className="text-muted">
                  Posting stays free. For <strong className="text-ink"><Money cents={COMPLIANCE_PLAN_CENTS} /> a month</strong>, your own pickups are funded first and
                  your SB 1383 donation records are kept ready to file.
                </p>
                <ul className="space-y-2">
                  {["Your trips funded before anyone else's", "What, when, how much and to whom, in one CSV", "Cancel any time from this screen"].map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <form action={subscribeCompliancePlan.bind(null, restaurant.id)}>
                  <SubmitButton variant="paypal" pendingText="Opening PayPal…" className="w-full">
                    Subscribe with PayPal
                  </SubmitButton>
                </form>
                <p className="text-xs text-muted">
                  {paypalMode() === "sandbox"
                    ? "Opens PayPal's sandbox. Log in with a sandbox personal account to approve."
                    : "PayPal is simulated here: the plan starts at once with a test payment."}
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>
      {(inFlight || awaitingFirstPayment) && <AutoRefresh everyMs={15_000} />}
    </>
  );
}
