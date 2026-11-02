import { Suspense } from "react";
import { connection } from "next/server";
import { ExternalLink, Lock } from "lucide-react";
import { getDb } from "@/db";
import { driverSetAvailable } from "@/app/actions";
import { allDrivers, tripViews, type TripView } from "@/lib/queries";
import { AutoRefresh } from "@/components/auto-refresh";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Container, dateLabel, Empty, Money, Notice, PageHeader, Panel, readable, RescueSteps, Skeleton, smallButton, timeLabel } from "@/components/ui";
import { PageArt } from "@/components/page-art";
import { personaId } from "@/lib/demo-session";
import { PortalSignIn } from "@/app/demo/people";
import { JobLeg } from "./job-leg";

export const metadata = { title: "For drivers" };

export default function DriverPage({ searchParams }: PageProps<"/driver">) {
  return (
    <Container size="app">
      <Suspense
        fallback={
          <>
            <PageHeader art={<PageArt page="driver" />} kicker="For volunteer drivers" title="Tonight's run" />
            <div className="py-8">
              <Skeleton lines={6} />
            </div>
          </>
        }
      >
        <DriverView searchParams={searchParams} />
      </Suspense>
      <AutoRefresh />
    </Container>
  );
}

const ACTIVE = ["assigned", "picked_up", "delivered", "needs_review"] as const;
const mapLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

async function DriverView({ searchParams }: { searchParams: PageProps<"/driver">["searchParams"] }) {
  await connection();
  const db = getDb();
  const drivers = await allDrivers(db);
  if (drivers.length === 0) return <Empty>No drivers yet. Run npm run setup to load the demo.</Empty>;

  const { d } = await searchParams;
  const signedIn = typeof d === "string" ? d : await personaId("driver");
  const driver = drivers.find((x) => x.id === signedIn);
  if (!driver)
    return <PortalSignIn role="driver" header={<PageHeader art={<PageArt page="driver" />} kicker="For volunteer drivers" title="Sign in to drive" description="Choose a volunteer driver to see their job for tonight." />} />;
  const trips = await tripViews(db, { driverId: driver.id, limit: 200 });
  const active = trips.find((t) => (ACTIVE as readonly string[]).includes(t.trip.status));
  const paid = trips.filter((t) => t.trip.status === "paid");
  const owed = trips.filter((t) => ["verified", "payout_pending"].includes(t.trip.status));
  const paidTotal = paid.reduce((s, t) => s + t.trip.stipendCents, 0);

  return (
    <>
      <PageHeader art={<PageArt page="driver" />} kicker="For volunteer drivers" title="Tonight's run" description="One job at a time. Your fuel money is reserved before you set off and paid when the shelter confirms." />

      <div className="grid items-start gap-6 py-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
            <p className="flex items-center gap-2.5 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${driver.available ? "bg-ok" : "bg-muted"}`} aria-hidden />
              {driver.available ? "You're available for rescues tonight" : "You're off duty. No new jobs will be sent."}
            </p>
            <form action={driverSetAvailable.bind(null, driver.id, !driver.available)}>
              <SubmitButton variant="secondary" pendingText="Saving…" className={smallButton}>
                {driver.available ? "Go off duty" : "Go on duty"}
              </SubmitButton>
            </form>
          </div>

          {active ? (
            <ActiveJob view={active} driver={driver} />
          ) : (
            <Panel title="No job right now">
              <Empty>
                {driver.available
                  ? "When a funded pickup near you is posted, it appears here. This page refreshes by itself."
                  : "Go on duty to receive pickups near you."}
              </Empty>
            </Panel>
          )}
        </div>

        <Panel title="Your reimbursements" action={<Badge tone="info">{driver.payoutWallet === "venmo" ? "To Venmo" : "To PayPal"}</Badge>}>
          <div className="mb-5">
            <p className="font-display text-4xl font-semibold tabular-nums tracking-[-0.03em]">
              <Money cents={paidTotal} />
            </p>
            <p className="mt-1 text-sm text-muted">
              from {paid.length} rescue{paid.length === 1 ? "" : "s"}
              {owed.length > 0 && (
                <>
                  {" · "}
                  <span className="text-ok">
                    <Money cents={owed.reduce((s, t) => s + t.trip.stipendCents, 0)} /> on its way
                  </span>
                </>
              )}
            </p>
          </div>
          {paid.length === 0 ? (
            <Empty>Your first reimbursement will show here.</Empty>
          ) : (
            <ul className="divide-y divide-line border-t border-line text-sm">
              {paid.slice(0, 8).map((t) => (
                <li key={t.trip.id} className="flex items-baseline justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate">
                      {t.restaurant.name} → {t.shelter.publicLabel}
                    </span>
                    <span className="block text-xs text-muted">
                      {dateLabel(t.trip.paidAt)} · {t.funding.map((f) => f.label).join(", ")}
                    </span>
                  </span>
                  <Money cents={t.trip.stipendCents} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function ActiveJob({ view, driver }: { view: TripView; driver: { id: string; lat: number; lng: number } }) {
  const { trip, restaurant, shelter, listing } = view;
  const hideAddress = shelter.confidential && trip.status === "assigned";
  const title =
    trip.status === "assigned" ? `Pick up at ${restaurant.name}` : trip.status === "picked_up" ? `Take it to ${shelter.name}` : "Delivery made";

  return (
    <Panel>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
            <p className="text-right">
              <span className="block font-display text-2xl font-semibold tabular-nums">
                <Money cents={trip.stipendCents} />
              </span>
              <span className="text-xs text-muted">reserved for you</span>
            </p>
          </div>
          <RescueSteps status={trip.status} />
        </div>

        <p className="text-sm">
          <strong>{listing.totalPortions} portions</strong> of {listing.items.map((i) => i.name).join(", ")}
          {listing.allergens.length > 0 && <span className="text-muted"> · contains {readable(listing.allergens)}, keep it sealed</span>}
        </p>

        <ol className="relative space-y-5 border-l border-line pl-6">
          <Stop
            n={1}
            current={trip.status === "assigned"}
            when={`Pick up by ${timeLabel(trip.plannedPickupAt)}`}
            name={restaurant.name}
            address={<MapLink lat={restaurant.lat} lng={restaurant.lng} label={restaurant.address} />}
          />
          <Stop
            n={2}
            current={trip.status === "picked_up"}
            when={`Drop off by ${timeLabel(trip.plannedDropoffAt)} · ${trip.distanceKm} km`}
            name={shelter.name}
            address={
              // Confidential shelters: the address is shown only to the assigned driver, once the food is on board.
              hideAddress ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <Lock className="h-3.5 w-3.5" aria-hidden /> Private address, shown after pickup
                </span>
              ) : (
                <MapLink lat={shelter.lat} lng={shelter.lng} label={shelter.address} />
              )
            }
          />
        </ol>

        {trip.status === "assigned" && (
          <JobLeg
            key="pickup"
            stage="pickup"
            tripId={trip.id}
            driverId={driver.id}
            from={{ lat: driver.lat, lng: driver.lng }}
            to={{ lat: restaurant.lat, lng: restaurant.lng }}
            toLabel={restaurant.name}
          />
        )}
        {trip.status === "picked_up" && (
          <JobLeg
            key="dropoff"
            stage="dropoff"
            tripId={trip.id}
            driverId={driver.id}
            from={{ lat: restaurant.lat, lng: restaurant.lng }}
            to={{ lat: shelter.lat, lng: shelter.lng }}
            toLabel={shelter.publicLabel}
          />
        )}
        {trip.status === "delivered" && <Notice tone="ok" title="Delivered. Thank you.">As soon as the shelter confirms, PayPal sends your reimbursement.</Notice>}
        {trip.status === "needs_review" && (
          <Notice tone="warn" title="A coordinator is checking this delivery before paying.">
            {trip.verification?.notes.filter((n) => !n.startsWith("Demo mode")).join(" ")}
          </Notice>
        )}
      </div>
    </Panel>
  );
}

function Stop({ n, current, when, name, address }: { n: number; current: boolean; when: string; name: string; address: React.ReactNode }) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[33px] top-0.5 grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold ${current ? "bg-brand text-on-brand" : "border border-line bg-bg text-muted"}`}
        aria-hidden
      >
        {n}
      </span>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{when}</p>
      <p className="mt-0.5 font-semibold">{name}</p>
      <p className="text-sm">{address}</p>
    </li>
  );
}

function MapLink({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  return (
    <a className="inline-flex items-center gap-1 text-ink underline decoration-line underline-offset-4 hover:decoration-ink" href={mapLink(lat, lng)} target="_blank" rel="noreferrer">
      {label} <ExternalLink className="h-3.5 w-3.5 text-muted" aria-hidden />
    </a>
  );
}
