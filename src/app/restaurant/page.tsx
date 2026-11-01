import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { allRestaurants, recentListings, tripViews } from "@/lib/queries";
import { Picker } from "@/components/picker";
import { Badge, Card, Empty, PageTitle, Skeleton, TripStatusBadge, timeLabel } from "@/components/ui";
import { PostSurplusForm } from "./post-surplus-form";

export default function RestaurantPage({ searchParams }: PageProps<"/restaurant">) {
  return (
    <>
      <PageTitle title="Post tonight's surplus" subtitle="One photo. We handle the shelter, the driver and the paperwork." />
      <Suspense fallback={<Card><Skeleton lines={5} /></Card>}>
        <RestaurantView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function RestaurantView({ searchParams }: { searchParams: PageProps<"/restaurant">["searchParams"] }) {
  await connection();
  const db = getDb();
  const restaurants = await allRestaurants(db);
  if (restaurants.length === 0) return <Empty>No restaurants yet. Run npm run setup to load the demo.</Empty>;

  const { r } = await searchParams;
  const restaurant = restaurants.find((x) => x.id === r) ?? restaurants[0];
  const [listings, trips] = await Promise.all([recentListings(db, restaurant.id), tripViews(db, { limit: 50 })]);
  const tripByListing = new Map(trips.map((t) => [t.listing.id, t]));

  return (
    <>
      <Picker label="You are:" items={restaurants} selectedId={restaurant.id} param="r" path="/restaurant" />
      <div className="space-y-5">
        <Card
          title={restaurant.name}
          action={
            restaurant.plan === "compliance" ? (
              <Badge tone="leaf">SB 1383 compliance plan</Badge>
            ) : (
              <Badge>Free plan</Badge>
            )
          }
        >
          <PostSurplusForm restaurantId={restaurant.id} />
        </Card>

        <Card title="Recent pickups">
          {listings.length === 0 ? (
            <Empty>Nothing posted yet tonight.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {listings.map((l) => {
                const trip = tripByListing.get(l.id);
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {l.totalPortions} portions · {l.items.map((i) => i.name).join(", ")}
                      </p>
                      <p className="text-muted">
                        Posted {timeLabel(l.createdAt)}
                        {trip ? ` · to ${trip.shelter.publicLabel}` : ""}
                      </p>
                    </div>
                    {trip ? (
                      <TripStatusBadge status={trip.trip.status} />
                    ) : l.safetyStatus === "rejected" ? (
                      <Badge tone="berry">Not safe to rescue</Badge>
                    ) : (
                      <Badge tone="saffron">{l.safetyStatus === "review" ? "Safety check" : "Finding shelter"}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
