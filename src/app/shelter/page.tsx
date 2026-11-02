import { Suspense } from "react";
import { connection } from "next/server";
import { Check } from "lucide-react";
import { getDb } from "@/db";
import { shelterConfirm, shelterNeedFilled, shelterSetAccepting, shelterSetCapacity } from "@/app/actions";
import { allShelters, shelterNeeds, tripViews } from "@/lib/queries";
import { AutoRefresh } from "@/components/auto-refresh";
import { LiveMap } from "@/components/live-map";
import { Picker } from "@/components/picker";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Container, Empty, inputClass, PageHeader, Panel, readable, Skeleton, smallButton, TripStatusBadge, timeLabel } from "@/components/ui";

export const metadata = { title: "For shelters" };

export default function ShelterPage({ searchParams }: PageProps<"/shelter">) {
  return (
    <Container>
      <Suspense
        fallback={
          <>
            <PageHeader kicker="For shelters and NGOs" title="Food coming tonight" />
            <div className="py-8">
              <Skeleton lines={6} />
            </div>
          </>
        }
      >
        <ShelterView searchParams={searchParams} />
      </Suspense>
      <AutoRefresh />
    </Container>
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
  const past = trips.filter((t) => !INCOMING.includes(t.trip.status)).slice(0, 6);
  const portionsComing = incoming.reduce((sum, t) => sum + t.listing.totalPortions, 0);
  const onRoad = incoming.filter((t) => t.trip.status === "assigned" || t.trip.status === "picked_up");

  return (
    <>
      <PageHeader
        kicker="For shelters and NGOs"
        title="Food coming tonight"
        description="Watch it arrive, then tap once when it's in your kitchen. That tap releases the driver's reimbursement."
      >
        <Picker items={shelters} selectedId={shelter.id} param="s" path="/shelter" />
      </PageHeader>

      <div className="space-y-6 py-8">
        <section aria-label="Tonight's settings" className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          <div className="bg-bg p-5">
            <p className="text-sm text-muted">On the way</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{portionsComing}</p>
            <p className="text-sm text-muted">portions in {incoming.length} rescue{incoming.length === 1 ? "" : "s"}</p>
          </div>
          <div className="bg-bg p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">Tonight</p>
              <Badge tone={shelter.acceptingFood ? "ok" : "neutral"}>{shelter.acceptingFood ? "Accepting food" : "Paused"}</Badge>
            </div>
            <p className="mt-2 text-sm">
              Open {shelter.opensAt}–{shelter.closesAt}
              {shelter.dietRequirements.length > 0 && <span className="text-muted"> · only {readable(shelter.dietRequirements)}</span>}
            </p>
            <form action={shelterSetAccepting.bind(null, shelter.id, !shelter.acceptingFood)} className="mt-3">
              <SubmitButton variant="secondary" pendingText="Saving…" className={smallButton}>
                {shelter.acceptingFood ? "Pause deliveries tonight" : "Start accepting food"}
              </SubmitButton>
            </form>
          </div>
          <form action={shelterSetCapacity.bind(null, shelter.id)} className="bg-bg p-5">
            <label htmlFor="capacity" className="text-sm text-muted">
              We can take up to
            </label>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <input id="capacity" name="capacity" type="number" min={5} max={2000} defaultValue={shelter.capacityPortions} className={`${inputClass} pr-20`} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">portions</span>
              </div>
              <SubmitButton variant="secondary" pendingText="…">
                Save
              </SubmitButton>
            </div>
            <p className="mt-2 text-xs text-muted">The matcher never sends more than this in one night.</p>
          </form>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Panel title="Arriving" description={incoming.length ? "Confirm each one when it's in your kitchen." : undefined}>
            {incoming.length === 0 ? (
              <Empty>{shelter.acceptingFood ? "Nothing on the way yet. When a restaurant nearby posts food that suits you, it shows here." : "Deliveries are paused for tonight."}</Empty>
            ) : (
              <ul className="space-y-3">
                {incoming.map((t) => {
                  const canConfirm = ["picked_up", "delivered"].includes(t.trip.status) && !t.trip.shelterConfirmedAt;
                  return (
                    <li key={t.trip.id} className={`rounded-xl border p-4 ${canConfirm ? "border-brand" : "border-line"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold">
                          {t.listing.totalPortions} portions · {t.listing.items.map((i) => i.name).join(", ")}
                        </p>
                        <TripStatusBadge status={t.trip.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        From {t.restaurant.name} · about {timeLabel(t.trip.plannedDropoffAt)}
                        {t.driver && !t.driver.anonymous ? ` · ${t.driver.name}` : ""}
                        {t.listing.allergens.length > 0 && ` · contains ${readable(t.listing.allergens)}`}
                      </p>
                      {canConfirm && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <form action={shelterConfirm.bind(null, t.trip.id, true)}>
                            <SubmitButton pendingText="Saving…" className="px-6">
                              <Check className="h-4 w-4" aria-hidden /> Received
                            </SubmitButton>
                          </form>
                          <form action={shelterConfirm.bind(null, t.trip.id, false)}>
                            <SubmitButton variant="danger" pendingText="Saving…">
                              Turn food away
                            </SubmitButton>
                          </form>
                        </div>
                      )}
                      {t.trip.shelterConfirmedAt && (
                        <p className="mt-2 text-sm text-muted">
                          {t.trip.shelterAccepted ? "You confirmed receipt. Thank you." : "You turned this food away. The driver is still reimbursed."}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel title="On the road">
              <LiveMap tripIds={onRoad.map((t) => t.trip.id)} height={260} />
            </Panel>
            <Panel title="What we still need">
              {needs.length === 0 ? (
                <Empty>No open needs.</Empty>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {needs.map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex items-center gap-2">
                        {n.quantity} × {n.item}
                        {n.urgency === "high" && <Badge tone="warn">Urgent</Badge>}
                      </span>
                      <form action={shelterNeedFilled.bind(null, n.id)}>
                        <SubmitButton variant="ghost" pendingText="…" className={`${smallButton} text-muted`}>
                          Mark filled
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Recent deliveries">
              {past.length === 0 ? (
                <Empty>No deliveries yet.</Empty>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {past.map((t) => (
                    <li key={t.trip.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span>
                        {t.listing.totalPortions} portions from {t.restaurant.name}
                      </span>
                      <TripStatusBadge status={t.trip.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
