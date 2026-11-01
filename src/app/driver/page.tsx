import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { driverPickup } from "@/app/actions";
import { allDrivers, tripViews, type TripView } from "@/lib/queries";
import { Picker } from "@/components/picker";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, Money, PageTitle, Skeleton, TripStatusBadge, timeLabel } from "@/components/ui";
import { DropoffForm } from "./dropoff-form";

export default function DriverPage({ searchParams }: PageProps<"/driver">) {
  return (
    <>
      <PageTitle title="Tonight's runs" subtitle="Pick up, drop off, get reimbursed before you're home." />
      <Suspense fallback={<Card><Skeleton lines={5} /></Card>}>
        <DriverView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const mapLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

async function DriverView({ searchParams }: { searchParams: PageProps<"/driver">["searchParams"] }) {
  await connection();
  const db = getDb();
  const drivers = await allDrivers(db);
  if (drivers.length === 0) return <Empty>No drivers yet. Run npm run setup to load the demo.</Empty>;

  const { d } = await searchParams;
  const driver = drivers.find((x) => x.id === d) ?? drivers[0];
  const trips = await tripViews(db, { driverId: driver.id, limit: 100 });
  const active = trips.find((t) => ["assigned", "picked_up", "delivered", "needs_review"].includes(t.trip.status));
  const paid = trips.filter((t) => t.trip.status === "paid");
  const owed = trips.filter((t) => ["verified", "payout_pending"].includes(t.trip.status));

  return (
    <>
      <Picker label="You are:" items={drivers} selectedId={driver.id} param="d" path="/driver" />
      <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
        <Card title="Next job">{active ? <ActiveJob view={active} driverId={driver.id} /> : <Empty>No job right now. We&apos;ll book you when a funded pickup is near.</Empty>}</Card>

        <Card title="Earnings" action={<Badge tone="sky">{driver.payoutWallet === "venmo" ? "Paid to Venmo" : "Paid to PayPal"}</Badge>}>
          <p className="font-display text-3xl font-semibold">
            <Money cents={paid.reduce((s, t) => s + t.trip.stipendCents, 0)} />
          </p>
          <p className="mb-3 text-sm text-muted">
            Fuel reimbursement from {paid.length} rescue{paid.length === 1 ? "" : "s"}
            {owed.length > 0 && <> · <Money cents={owed.reduce((s, t) => s + t.trip.stipendCents, 0)} /> on its way</>}
          </p>
          {paid.length === 0 ? (
            <Empty>Your first payout will show here.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {paid.map((t) => (
                <li key={t.trip.id} className="py-2">
                  <div className="flex justify-between">
                    <span>{t.restaurant.name} → {t.shelter.publicLabel}</span>
                    <Money cents={t.trip.stipendCents} />
                  </div>
                  <p className="text-xs text-muted">
                    Paid {timeLabel(t.trip.paidAt)} · funded by {t.funding.map((f) => f.label).join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function ActiveJob({ view, driverId }: { view: TripView; driverId: string }) {
  const { trip, restaurant, shelter, listing } = view;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <TripStatusBadge status={trip.status} />
        <span className="text-sm text-muted">
          {trip.distanceKm} km · <Money cents={trip.stipendCents} /> reimbursement, already funded
        </span>
      </div>
      <p className="text-sm">
        <strong>{listing.totalPortions} portions</strong> of {listing.items.map((i) => i.name).join(", ")}
        {listing.allergens.length > 0 && <span className="text-muted"> · contains {listing.allergens.join(", ")}</span>}
      </p>

      <ol className="space-y-3 text-sm">
        <li className="rounded-xl bg-cream p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Pick up by {timeLabel(trip.plannedPickupAt)}</p>
          <p className="font-medium">{restaurant.name}</p>
          <a className="text-sky underline" href={mapLink(restaurant.lat, restaurant.lng)} target="_blank" rel="noreferrer">
            {restaurant.address}
          </a>
        </li>
        <li className="rounded-xl bg-cream p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Drop off by {timeLabel(trip.plannedDropoffAt)}</p>
          <p className="font-medium">
            {shelter.name} {shelter.confidential && <Badge tone="berry">Private address</Badge>}
          </p>
          {/* Confidential shelters: the address is only shown to the assigned driver, once the food is on board. */}
          {shelter.confidential && trip.status === "assigned" ? (
            <p className="text-muted">{shelter.publicLabel}. Exact address appears after pickup.</p>
          ) : (
            <a className="text-sky underline" href={mapLink(shelter.lat, shelter.lng)} target="_blank" rel="noreferrer">
              {shelter.address}
            </a>
          )}
        </li>
      </ol>

      {trip.status === "assigned" && (
        <form action={driverPickup} className="space-y-3">
          <input type="hidden" name="tripId" value={trip.id} />
          <input type="hidden" name="driverId" value={driverId} />
          <PhotoInput label="Photo of the food at pickup" required />
          <SubmitButton pendingText="Saving…" className="w-full">Picked up</SubmitButton>
        </form>
      )}
      {trip.status === "picked_up" && <DropoffForm tripId={trip.id} driverId={driverId} shelter={shelter} />}
      {trip.status === "delivered" && <p className="rounded-xl bg-saffron-soft p-3 text-sm">Delivered. Waiting for the shelter to tap &ldquo;received&rdquo;, then you&apos;re paid.</p>}
      {trip.status === "needs_review" && (
        <p className="rounded-xl bg-berry-soft p-3 text-sm">
          A coordinator is checking this delivery before paying. {trip.verification?.notes.join(" ")}
        </p>
      )}
    </div>
  );
}
