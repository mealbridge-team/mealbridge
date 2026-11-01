import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import {
  alerts,
  drivers,
  fundingPools,
  listings,
  matches,
  needs,
  reservations,
  restaurants,
  shelters,
  trips,
  type TripStatus,
} from "@/db/schema";

export type TripView = Awaited<ReturnType<typeof tripViews>>[number];

// Everything the screens show about a trip, including which funds pay for it.
export async function tripViews(db: Db, where?: { statuses?: TripStatus[]; driverId?: string; shelterId?: string; limit?: number }) {
  const conditions = [];
  if (where?.statuses) conditions.push(inArray(trips.status, where.statuses));
  if (where?.driverId) conditions.push(eq(trips.driverId, where.driverId));
  if (where?.shelterId) conditions.push(eq(matches.shelterId, where.shelterId));

  const rows = await db
    .select({ trip: trips, match: matches, listing: listings, restaurant: restaurants, shelter: shelters, driver: drivers })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .innerJoin(restaurants, eq(restaurants.id, listings.restaurantId))
    .innerJoin(shelters, eq(shelters.id, matches.shelterId))
    .leftJoin(drivers, eq(drivers.id, trips.driverId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(trips.createdAt))
    .limit(where?.limit ?? 50);

  const tripIds = rows.map((r) => r.trip.id);
  const funding = tripIds.length
    ? await db
        .select({ tripId: reservations.tripId, amountCents: reservations.amountCents, status: reservations.status, label: fundingPools.label, kind: fundingPools.kind })
        .from(reservations)
        .innerJoin(fundingPools, eq(fundingPools.id, reservations.poolId))
        .where(and(inArray(reservations.tripId, tripIds), inArray(reservations.status, ["held", "paid"])))
    : [];

  return rows.map((r) => ({ ...r, funding: funding.filter((f) => f.tripId === r.trip.id) }));
}

export async function openAlerts(db: Db) {
  return db.select().from(alerts).where(eq(alerts.resolved, false)).orderBy(desc(alerts.createdAt)).limit(30);
}

export async function allRestaurants(db: Db) {
  return db.select().from(restaurants).orderBy(restaurants.name);
}

export async function allDrivers(db: Db) {
  return db.select().from(drivers).orderBy(drivers.name);
}

export async function allShelters(db: Db) {
  return db.select().from(shelters).orderBy(shelters.name);
}

export async function shelterNeeds(db: Db, shelterId: string) {
  return db.select().from(needs).where(and(eq(needs.shelterId, shelterId), eq(needs.status, "open")));
}

export async function recentListings(db: Db, restaurantId: string) {
  return db.select().from(listings).where(eq(listings.restaurantId, restaurantId)).orderBy(desc(listings.createdAt)).limit(10);
}
