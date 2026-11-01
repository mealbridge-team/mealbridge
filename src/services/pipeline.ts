import { and, eq, gte, inArray, notInArray } from "drizzle-orm";
import type { Db } from "@/db";
import { alerts, drivers, listings, matches, restaurants, shelters, trips, type TripStatus } from "@/db/schema";
import { explain } from "@/agents/explain";
import { rankShelters } from "@/domain/matcher";
import { stipendCents } from "@/domain/stipend";
import { driveMinutes, roadKm } from "@/lib/geo";
import { fundTrip, releaseTrip } from "./treasury";

const LOADING_MINUTES = 10;
const FINISHED: TripStatus[] = ["cancelled", "paid"];
const ON_THE_ROAD: TripStatus[] = ["assigned", "picked_up"];

// Portions already heading to each shelter in the last 12 hours.
async function incomingPortions(db: Db, now: Date) {
  const since = new Date(now.getTime() - 12 * 3_600_000);
  const rows = await db
    .select({ shelterId: matches.shelterId, portions: listings.totalPortions })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .where(and(gte(trips.createdAt, since), notInArray(trips.status, ["cancelled"])));
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.shelterId, (totals.get(r.shelterId) ?? 0) + r.portions);
  return totals;
}

export type MatchOutcome =
  | { kind: "matched"; tripId: string; shelterName: string; reason: string; funded: boolean; driverName: string | null }
  | { kind: "no_shelter"; reasons: string[] }
  | { kind: "not_open" };

// Matcher agent: picks the shelter (deterministic score), explains the pick, creates the trip,
// reserves its money, and hands it to Dispatch if funded.
export async function matchListing(db: Db, listingId: string, now = new Date()): Promise<MatchOutcome> {
  const [row] = await db
    .select({ listing: listings, restaurant: restaurants })
    .from(listings)
    .innerJoin(restaurants, eq(restaurants.id, listings.restaurantId))
    .where(eq(listings.id, listingId));
  if (!row || row.listing.status !== "open" || row.listing.safetyStatus !== "approved") return { kind: "not_open" };
  const { listing, restaurant } = row;

  const incoming = await incomingPortions(db, now);
  const allShelters = await db.select().from(shelters);
  const { ranked, rejected } = rankShelters(
    {
      lat: restaurant.lat,
      lng: restaurant.lng,
      totalPortions: listing.totalPortions,
      dietTags: listing.dietTags,
      allergens: listing.allergens,
      safeUntil: listing.readyUntil,
    },
    allShelters.map((s) => ({ ...s, incomingPortions: incoming.get(s.id) ?? 0 })),
    now,
  );

  if (ranked.length === 0) {
    await db.insert(alerts).values({
      kind: "unsafe_listing",
      message: `No shelter can take ${restaurant.name}'s ${listing.totalPortions} portions right now.`,
    });
    return { kind: "no_shelter", reasons: rejected.map((r) => r.reason) };
  }

  const best = ranked[0];
  const shelter = allShelters.find((s) => s.id === best.shelterId)!;
  const reason = await explain(
    "Explain why this shelter was picked for tonight's surplus.",
    {
      shelter: shelter.name,
      minutesAway: best.etaMinutes,
      portionsTheyCanUse: best.usablePortions,
      totalPortions: listing.totalPortions,
      shelterRequirementsMet: shelter.dietRequirements,
      runnerUp: ranked[1] ? allShelters.find((s) => s.id === ranked[1].shelterId)?.name : null,
    },
    best.reason,
  );

  const [match] = await db
    .insert(matches)
    .values({ listingId, shelterId: shelter.id, score: best.score, reason })
    .returning();
  await db.update(listings).set({ status: "matched" }).where(eq(listings.id, listingId));

  const pickupAt = new Date(now.getTime() + 20 * 60_000);
  const [trip] = await db
    .insert(trips)
    .values({
      matchId: match.id,
      distanceKm: best.distanceKm,
      stipendCents: stipendCents(best.distanceKm),
      plannedPickupAt: pickupAt,
      plannedDropoffAt: new Date(pickupAt.getTime() + (LOADING_MINUTES + best.etaMinutes) * 60_000),
    })
    .returning();

  const { funded } = await fundTrip(db, trip.id);
  const driverName = funded ? (await dispatchTrip(db, trip.id, now))?.driverName ?? null : null;
  return { kind: "matched", tripId: trip.id, shelterName: shelter.name, reason, funded, driverName };
}

// Dispatch agent: books the nearest free driver. Only funded trips are dispatched.
export async function dispatchTrip(
  db: Db,
  tripId: string,
  now = new Date(),
  exclude: string[] = [],
): Promise<{ driverName: string } | null> {
  const [row] = await db
    .select({ trip: trips, restaurant: restaurants })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .innerJoin(restaurants, eq(restaurants.id, listings.restaurantId))
    .where(eq(trips.id, tripId));
  if (!row || row.trip.status !== "funded") return null;

  const busy = await db
    .select({ driverId: trips.driverId })
    .from(trips)
    .where(inArray(trips.status, ON_THE_ROAD));
  const busyIds = new Set([...busy.map((b) => b.driverId), ...exclude]);

  const candidates = (await db.select().from(drivers).where(eq(drivers.available, true)))
    .filter((d) => !busyIds.has(d.id))
    .map((d) => ({ driver: d, km: roadKm(d, row.restaurant) }))
    .sort((a, b) => a.km - b.km);

  if (candidates.length === 0) {
    await db.insert(alerts).values({
      kind: "late_driver",
      tripId,
      message: `No driver is free for the ${row.restaurant.name} pickup. It's funded and waiting.`,
    });
    return null;
  }

  const { driver, km } = candidates[0];
  const pickupAt = new Date(now.getTime() + driveMinutes(km) * 60_000);
  const legMinutes = row.trip.plannedDropoffAt.getTime() - row.trip.plannedPickupAt.getTime();
  await db
    .update(trips)
    .set({
      driverId: driver.id,
      status: "assigned",
      plannedPickupAt: pickupAt,
      plannedDropoffAt: new Date(pickupAt.getTime() + legMinutes),
    })
    .where(eq(trips.id, tripId));
  return { driverName: driver.name };
}

// A driver drops out before pickup: hand the trip to the next-best driver, keeping the money reserved.
export async function reassignTrip(db: Db, tripId: string, now = new Date()) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip || trip.status !== "assigned") return null;
  const previous = trip.driverId;
  await db.update(trips).set({ status: "funded", driverId: null }).where(eq(trips.id, tripId));
  const next = await dispatchTrip(db, tripId, now, previous ? [previous] : []);
  return { previousDriverId: previous, next };
}

// Cancels a trip that hasn't been picked up, returning its reserved money to the pools.
export async function cancelTrip(db: Db, tripId: string) {
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip || FINISHED.includes(trip.status) || !["unfunded", "funded", "assigned"].includes(trip.status)) {
    return false;
  }
  await releaseTrip(db, tripId);
  return true;
}
