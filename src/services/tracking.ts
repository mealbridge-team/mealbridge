import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { drivers, matches, listings, restaurants, shelters, trips } from "@/db/schema";
import { driveMinutes, haversineKm, roadKm } from "@/lib/geo";

export const LIVE_STATUSES = ["assigned", "picked_up"] as const;

// Drivers near a confidential shelter stop showing on public maps, so the map can't reveal it.
const CONFIDENTIAL_RADIUS_KM = 1.2;

export async function recordPosition(
  db: Db,
  input: { tripId: string; driverId: string; lat: number; lng: number; simulated: boolean },
) {
  if (Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) return false;
  const updated = await db
    .update(trips)
    .set({ lastLat: input.lat, lastLng: input.lng, lastPositionAt: new Date(), positionSimulated: input.simulated })
    .where(and(eq(trips.id, input.tripId), eq(trips.driverId, input.driverId), inArray(trips.status, [...LIVE_STATUSES])))
    .returning({ id: trips.id });
  return updated.length > 0;
}

type Point = { lat: number; lng: number };

export type LiveTrip = {
  tripId: string;
  status: (typeof LIVE_STATUSES)[number];
  driverName: string;
  portions: number;
  restaurant: Point & { name: string };
  // Approximate (about 1 km) for confidential shelters.
  shelter: Point & { label: string; confidential: boolean };
  driver: (Point & { simulated: boolean; secondsAgo: number }) | null;
  hidden: boolean;
  etaMinutes: number | null;
};

const blur = (value: number) => Math.round(value * 100) / 100;

// Everything a map needs about trips on the road right now, safe to show publicly.
export async function liveTrips(db: Db, now = new Date()): Promise<LiveTrip[]> {
  const rows = await db
    .select({ trip: trips, driver: drivers, restaurant: restaurants, shelter: shelters, listing: listings })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .innerJoin(restaurants, eq(restaurants.id, listings.restaurantId))
    .innerJoin(shelters, eq(shelters.id, matches.shelterId))
    .innerJoin(drivers, eq(drivers.id, trips.driverId))
    .where(inArray(trips.status, [...LIVE_STATUSES]));

  return rows.map(({ trip, driver, restaurant, shelter, listing }) => {
    const status = trip.status as LiveTrip["status"];
    const target = status === "assigned" ? restaurant : shelter;
    const position = trip.lastLat != null && trip.lastLng != null ? { lat: trip.lastLat, lng: trip.lastLng } : null;
    const nearSecret = shelter.confidential && position != null && haversineKm(position, shelter) < CONFIDENTIAL_RADIUS_KM;

    let etaMinutes: number | null = null;
    if (position) {
      const toTarget = driveMinutes(roadKm(position, target));
      etaMinutes = status === "assigned" ? toTarget + 10 + driveMinutes(roadKm(restaurant, shelter)) : toTarget;
    }

    return {
      tripId: trip.id,
      status,
      driverName: driver.anonymous ? "Volunteer driver" : driver.name,
      portions: listing.totalPortions,
      restaurant: { lat: restaurant.lat, lng: restaurant.lng, name: restaurant.name },
      shelter: shelter.confidential
        ? { lat: blur(shelter.lat), lng: blur(shelter.lng), label: shelter.publicLabel, confidential: true }
        : { lat: shelter.lat, lng: shelter.lng, label: shelter.name, confidential: false },
      driver:
        position && !nearSecret
          ? {
              ...position,
              simulated: trip.positionSimulated,
              secondsAgo: Math.round((now.getTime() - (trip.lastPositionAt?.getTime() ?? now.getTime())) / 1000),
            }
          : null,
      hidden: nearSecret,
      etaMinutes,
    };
  });
}
