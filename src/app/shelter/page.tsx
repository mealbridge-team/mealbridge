import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { shelterConfirm } from "@/app/actions";
import { allShelters, shelterNeeds, tripViews } from "@/lib/queries";
import { AutoRefresh } from "@/components/auto-refresh";
import { LiveMap } from "@/components/live-map";
import { Picker } from "@/components/picker";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, PageTitle, readable, Skeleton, TripStatusBadge, timeLabel } from "@/components/ui";

export default function ShelterPage({ searchParams }: PageProps<"/shelter">) {
  return (
    <>
      <PageTitle eyebrow="For shelters" title="Food coming tonight" subtitle="Watch it arrive, then tap once when it's in your kitchen. That tap releases the driver's reimbursement." />
      <Suspense fallback={<Card><Skeleton lines={6} /></Card>}>
        <ShelterView searchParams={searchParams} />
      </Suspense>
      <AutoRefresh />
    </>
  );
}

const INCOMING = ["unfunded", "funded", "assigned", "picked_up", "delivered"];

async function ShelterView({ searchParams }: { searchParams: PageProps<"/shelter">["searchParams"] }) {
  await connection();
  const db = getDb();
  const shelters = await allShelters(db);
  if (shelters.length === 0) return <Empty>No shelters yet. Run npm run setup to load the demo.</Empty>;

  const { s } = await searchParams;
  // Without a choice, open on the shelter with the newest food on its way.
  const [newest] = await tripViews(db, { statuses: ["funded", "assigned", "picked_up", "delivered"], limit: 1 });
  const shelter = shelters.find((x) => x.id === s) ?? shelters.find((x) => x.id === newest?.shelter.id) ?? shelters[0];
  const [trips, needs] = await Promise.all([tripViews(db, { shelterId: shelter.id, limit: 60 }), shelterNeeds(db, shelter.id)]);
  const incoming = trips.filter((t) => INCOMING.includes(t.trip.status));
  const past = trips.filter((t) => !INCOMING.includes(t.trip.status)).slice(0, 8);
  const portionsComing = incoming.reduce((sum, t) => sum + t.listing.totalPortions, 0);
  const onRoad = incoming.filter((t) => t.trip.status === "assigned" || t.trip.status === "picked_up");

  return (
    <div className="space-y-5">
      <Picker label="Demo: you are" items={shelters} selectedId={shelter.id} param="s" path="/shelter" />
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone="leaf">{portionsComing} portions on the way</Badge>
        <Badge>Open {shelter.opensAt}–{shelter.closesAt}</Badge>
        <Badge>Room for about {shelter.capacityPortions} portions a night</Badge>
        {shelter.dietRequirements.length > 0 && <Badge tone="sky">Only sent: {shelter.dietRequirements.join(", ").replaceAll("_", "-")}</Badge>}
        {shelter.confidential && <Badge tone="berry">Address kept private</Badge>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Arriving">
          {incoming.length === 0 ? (
            <Empty>Nothing on the way yet. When a restaurant nearby posts food that suits you, it shows here.</Empty>
          ) : (
            <ul className="space-y-3">
              {incoming.map((t) => {
                const canConfirm = ["picked_up", "delivered"].includes(t.trip.status) && !t.trip.shelterConfirmedAt;
                return (
                  <li key={t.trip.id} className={`rounded-2xl border p-4 ${canConfirm ? "border-tomato bg-tomato-soft/50" : "border-line"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-lg font-semibold">
                        {t.listing.totalPortions} portions · {t.listing.items.map((i) => i.name).join(", ")}
                      </p>
                      <TripStatusBadge status={t.trip.status} />
                    </div>
                    <p className="text-sm text-muted">
                      From {t.restaurant.name} · expected about {timeLabel(t.trip.plannedDropoffAt)}
                      {t.driver && !t.driver.anonymous ? ` with ${t.driver.name}` : ""}
                    </p>
                    {t.listing.allergens.length > 0 && <p className="text-sm text-muted">Contains {readable(t.listing.allergens)}</p>}
                    {canConfirm && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={shelterConfirm.bind(null, t.trip.id, true)}>
                          <SubmitButton pendingText="Saving…" className="px-6 py-3 text-base">
                            ✓ Received
                          </SubmitButton>
                        </form>
                        <form action={shelterConfirm.bind(null, t.trip.id, false)}>
                          <SubmitButton variant="danger" pendingText="Saving…" className="py-3">
                            Turn food away
                          </SubmitButton>
                        </form>
                      </div>
                    )}
                    {t.trip.shelterConfirmedAt && (
                      <p className="mt-2 text-xs text-muted">
                        {t.trip.shelterAccepted ? "You confirmed receipt. Thank you." : "You turned this food away. The driver is still reimbursed."}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="On the road">
            <LiveMap tripIds={onRoad.map((t) => t.trip.id)} height={260} />
          </Card>
          <Card title="Still needed">
            {needs.length === 0 ? (
              <Empty>No open needs.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {needs.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-2">
                    <span>
                      {n.quantity} × {n.item}
                    </span>
                    <Badge tone={n.urgency === "high" ? "tomato" : n.urgency === "medium" ? "saffron" : "muted"}>{n.urgency}</Badge>
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
                  <li key={t.trip.id} className="flex items-center justify-between gap-2 py-2">
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
    </div>
  );
}
