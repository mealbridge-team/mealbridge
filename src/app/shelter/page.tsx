import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { shelterConfirm } from "@/app/actions";
import { allShelters, shelterNeeds, tripViews } from "@/lib/queries";
import { Picker } from "@/components/picker";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, PageTitle, Skeleton, TripStatusBadge, timeLabel } from "@/components/ui";

export default function ShelterPage({ searchParams }: PageProps<"/shelter">) {
  return (
    <>
      <PageTitle title="Incoming food" subtitle="See what's coming tonight, and confirm when it arrives." />
      <Suspense fallback={<Card><Skeleton lines={5} /></Card>}>
        <ShelterView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ShelterView({ searchParams }: { searchParams: PageProps<"/shelter">["searchParams"] }) {
  await connection();
  const db = getDb();
  const shelters = await allShelters(db);
  if (shelters.length === 0) return <Empty>No shelters yet. Run npm run setup to load the demo.</Empty>;

  const { s } = await searchParams;
  const shelter = shelters.find((x) => x.id === s) ?? shelters[0];
  const [trips, needs] = await Promise.all([tripViews(db, { shelterId: shelter.id }), shelterNeeds(db, shelter.id)]);
  const incoming = trips.filter((t) => ["unfunded", "funded", "assigned", "picked_up", "delivered"].includes(t.trip.status));
  const past = trips.filter((t) => !incoming.includes(t)).slice(0, 10);

  return (
    <>
      <Picker label="You are:" items={shelters} selectedId={shelter.id} param="s" path="/shelter" />
      <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
        <Card
          title="Coming tonight"
          action={shelter.dietRequirements.length > 0 && <span className="text-xs text-muted">Only sent: {shelter.dietRequirements.join(", ").replaceAll("_", "-")}</span>}
        >
          {incoming.length === 0 ? (
            <Empty>Nothing on the way yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {incoming.map((t) => {
                const canConfirm = ["picked_up", "delivered"].includes(t.trip.status) && !t.trip.shelterConfirmedAt;
                return (
                  <li key={t.trip.id} className="rounded-xl border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {t.listing.totalPortions} portions · {t.listing.items.map((i) => i.name).join(", ")}
                      </p>
                      <TripStatusBadge status={t.trip.status} />
                    </div>
                    <p className="text-muted">
                      From {t.restaurant.name} · arriving about {timeLabel(t.trip.plannedDropoffAt)}
                      {t.driver && !t.driver.anonymous ? ` with ${t.driver.name}` : ""}
                    </p>
                    {t.listing.allergens.length > 0 && <p className="text-muted">Contains {t.listing.allergens.join(", ")}</p>}
                    {canConfirm && (
                      <div className="mt-3 flex gap-2">
                        <form action={shelterConfirm.bind(null, t.trip.id, true)}>
                          <SubmitButton pendingText="Saving…">Received</SubmitButton>
                        </form>
                        <form action={shelterConfirm.bind(null, t.trip.id, false)}>
                          <SubmitButton variant="danger" pendingText="Saving…">Reject food</SubmitButton>
                        </form>
                      </div>
                    )}
                    {t.trip.shelterConfirmedAt && (
                      <p className="mt-2 text-xs text-muted">
                        {t.trip.shelterAccepted ? "You confirmed receipt." : "You rejected this food. The driver is still reimbursed."}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="What we still need">
            {needs.length === 0 ? (
              <Empty>No open needs.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {needs.map((n) => (
                  <li key={n.id} className="flex items-center justify-between">
                    <span>
                      {n.quantity} × {n.item}
                    </span>
                    <Badge tone={n.urgency === "high" ? "berry" : n.urgency === "medium" ? "saffron" : "muted"}>{n.urgency}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Recent deliveries">
            {past.length === 0 ? (
              <Empty>No deliveries yet.</Empty>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {past.map((t) => (
                  <li key={t.trip.id} className="flex justify-between py-2">
                    <span>
                      {t.listing.totalPortions} portions from {t.restaurant.name}
                    </span>
                    <TripStatusBadge status={t.trip.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
