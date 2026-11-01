import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { driverPickup } from "@/app/actions";
import { allDrivers, tripViews, type TripView } from "@/lib/queries";
import { AutoRefresh } from "@/components/auto-refresh";
import { Picker } from "@/components/picker";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, Money, Notice, PageTitle, readable, RescueSteps, Skeleton, timeLabel } from "@/components/ui";
import { DropoffForm } from "./dropoff-form";
import { LiveShare } from "./live-share";

export default function DriverPage({ searchParams }: PageProps<"/driver">) {
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="For volunteer drivers" title="Tonight's run" subtitle="Pick up, drop off, and your fuel money is on its way before you're home." />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <DriverView searchParams={searchParams} />
      </Suspense>
      <AutoRefresh />
    </div>
  );
}

const mapLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

async function DriverView({ searchParams }: { searchParams: PageProps<"/driver">["searchParams"] }) {
  await connection();
  const db = getDb();
  const drivers = await allDrivers(db);
  if (drivers.length === 0) return <Empty>No drivers yet. Run npm run setup to load the demo.</Empty>;

  const { d } = await searchParams;
  // Without a choice, open on whoever has the newest active job, so the demo flows from the restaurant.
  const [newest] = await tripViews(db, { statuses: ["assigned", "picked_up", "delivered", "needs_review"], limit: 1 });
  const driver = drivers.find((x) => x.id === d) ?? drivers.find((x) => x.id === newest?.trip.driverId) ?? drivers[0];
  const trips = await tripViews(db, { driverId: driver.id, limit: 200 });
  const active = trips.find((t) => ["assigned", "picked_up", "delivered", "needs_review"].includes(t.trip.status));
  const paid = trips.filter((t) => t.trip.status === "paid");
  const owed = trips.filter((t) => ["verified", "payout_pending"].includes(t.trip.status));
  const anotherDriver = drivers.find((x) => x.id !== driver.id && x.available);

  return (
    <div className="space-y-5">
      <Picker label="Demo: you are" items={drivers} selectedId={driver.id} param="d" path="/driver" />

      {active ? (
        <ActiveJob view={active} driver={driver} />
      ) : (
        <Card>
          <Empty>
            No job right now. When a funded pickup near you is posted, it appears here.
            {anotherDriver && <> Tip for the demo: the newest trip goes to the nearest free driver, so try other drivers in the menu above.</>}
          </Empty>
        </Card>
      )}

      <Card title="Your reimbursements" action={<Badge tone="sky">{driver.payoutWallet === "venmo" ? "Paid to Venmo" : "Paid to PayPal"}</Badge>}>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-4xl font-semibold text-leaf">
              <Money cents={paid.reduce((s, t) => s + t.trip.stipendCents, 0)} />
            </p>
            <p className="text-sm text-muted">from {paid.length} rescue{paid.length === 1 ? "" : "s"}</p>
          </div>
          {owed.length > 0 && (
            <Badge tone="saffron">
              <Money cents={owed.reduce((s, t) => s + t.trip.stipendCents, 0)} /> on its way
            </Badge>
          )}
        </div>
        {paid.length === 0 ? (
          <Empty>Your first reimbursement will show here.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {paid.slice(0, 8).map((t) => (
              <li key={t.trip.id} className="py-2.5">
                <div className="flex justify-between gap-2">
                  <span>
                    {t.restaurant.name} → {t.shelter.publicLabel}
                  </span>
                  <Money cents={t.trip.stipendCents} />
                </div>
                <p className="text-xs text-muted">
                  {t.trip.paidAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })} · funded by{" "}
                  {t.funding.map((f) => f.label).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ActiveJob({ view, driver }: { view: TripView; driver: { id: string; lat: number; lng: number } }) {
  const { trip, restaurant, shelter, listing } = view;
  const onTheRoad = trip.status === "assigned" || trip.status === "picked_up";
  const hideAddress = shelter.confidential && trip.status === "assigned";
  return (
    <Card title={trip.status === "assigned" ? "Go pick up" : trip.status === "picked_up" ? "Deliver the food" : "Delivery made"}>
      <div className="space-y-4">
        <RescueSteps status={trip.status} />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-leaf-soft px-4 py-3 text-sm">
          <span>
            <strong>{listing.totalPortions} portions</strong> of {listing.items.map((i) => i.name).join(", ")}
          </span>
          <span className="font-semibold text-leaf">
            <Money cents={trip.stipendCents} /> reserved for you
          </span>
        </div>
        {listing.allergens.length > 0 && <p className="text-xs text-muted">Contains {readable(listing.allergens)}. Keep it sealed.</p>}

        <ol className="space-y-2 text-sm">
          <li className={`rounded-2xl p-3 ${trip.status === "assigned" ? "bg-tomato-soft" : "bg-cream"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">1 · Pick up by {timeLabel(trip.plannedPickupAt)}</p>
            <p className="font-semibold">{restaurant.name}</p>
            <a className="text-sky underline" href={mapLink(restaurant.lat, restaurant.lng)} target="_blank" rel="noreferrer">
              {restaurant.address}
            </a>
          </li>
          <li className={`rounded-2xl p-3 ${trip.status === "picked_up" ? "bg-tomato-soft" : "bg-cream"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              2 · Drop off by {timeLabel(trip.plannedDropoffAt)} · {trip.distanceKm} km
            </p>
            <p className="font-semibold">
              {shelter.name} {shelter.confidential && <Badge tone="berry">Private address</Badge>}
            </p>
            {/* Confidential shelters: the address is only shown to the assigned driver, once the food is on board. */}
            {hideAddress ? (
              <p className="text-muted">{shelter.publicLabel}. The exact address appears after pickup.</p>
            ) : (
              <a className="text-sky underline" href={mapLink(shelter.lat, shelter.lng)} target="_blank" rel="noreferrer">
                {shelter.address}
              </a>
            )}
          </li>
        </ol>

        {onTheRoad && (
          <LiveShare
            key={trip.status}
            tripId={trip.id}
            driverId={driver.id}
            from={trip.status === "assigned" ? { lat: driver.lat, lng: driver.lng } : { lat: restaurant.lat, lng: restaurant.lng }}
            to={trip.status === "assigned" ? { lat: restaurant.lat, lng: restaurant.lng } : { lat: shelter.lat, lng: shelter.lng }}
            toLabel={trip.status === "assigned" ? restaurant.name : shelter.publicLabel}
          />
        )}

        {trip.status === "assigned" && (
          <form action={driverPickup} className="space-y-3">
            <input type="hidden" name="tripId" value={trip.id} />
            <input type="hidden" name="driverId" value={driver.id} />
            <PhotoInput label="Photo of the food at pickup" required />
            <SubmitButton pendingText="Saving…" className="w-full py-3 text-base">
              Picked up
            </SubmitButton>
          </form>
        )}
        {trip.status === "picked_up" && <DropoffForm tripId={trip.id} driverId={driver.id} shelter={shelter} />}
        {trip.status === "delivered" && <Notice>Delivered. As soon as the shelter taps &ldquo;received&rdquo;, PayPal sends your reimbursement.</Notice>}
        {trip.status === "needs_review" && (
          <Notice tone="berry">A coordinator is checking this delivery before paying. {trip.verification?.notes.join(" ")}</Notice>
        )}
      </div>
    </Card>
  );
}
