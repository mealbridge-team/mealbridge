import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { drivers, fundingPools, ledgerEntries, listings, matches, reservations, restaurants, shelters, trips } from "@/db/schema";
import { poolBalances } from "@/services/treasury";

// Flat, public-safe rows for the impact page: shelter public labels only, no
// addresses, and anonymous drivers stay anonymous.

const POUNDS_PER_PORTION = 0.75;
const AREA: Record<string, string> = { oakland: "Oakland", berkeley: "Berkeley", "san-francisco": "San Francisco" };
const FUNDER: Record<string, string> = {
  restaurant: "Restaurant plan",
  donor_area: "Area donors",
  sponsor: "Sponsors and grants",
  general: "General fund",
};
const FLOW: Record<string, string> = {
  donation: "Donations",
  restaurant_subscription: "Restaurant plans",
  sponsor_invoice: "Sponsor invoices",
  driver_payout: "Driver reimbursements",
  refund: "Refunds",
  gapfill_purchase: "Purchases",
};

const pacificDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);

function weekStart(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export type RescueRow = {
  rescueId: string;
  date: string;
  week: string;
  weekday: string;
  area: string;
  restaurant: string;
  shelter: string;
  driver: string;
  outcome: string;
  meals: number;
  pounds: number;
  distanceKm: number;
  reimbursementUsd: number;
  fundedBy: string;
  minutesToDeliver: number | null;
};

// Confidential shelters are drawn at their area's centre, never at their address.
const AREA_CENTRE: Record<string, { lat: number; lng: number }> = {
  oakland: { lat: 37.8044, lng: -122.2712 },
  berkeley: { lat: 37.8715, lng: -122.273 },
  "san-francisco": { lat: 37.7749, lng: -122.4194 },
};

export type MapPlace = { id: string; kind: "restaurant" | "shelter"; name: string; area: string; lat: number; lng: number };
export type MapRoute = { from: string; to: string; trips: number; meals: number };

export type MoneyRow = { date: string; week: string; direction: string; flow: string; fund: string; area: string; amountUsd: number };
export type FundRow = { fund: string; kind: string; availableUsd: number };

export async function impactData(db: Db) {
  const tripRows = await db
    .select({ trip: trips, listing: listings, restaurant: restaurants, shelter: shelters, driver: drivers })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .innerJoin(restaurants, eq(restaurants.id, listings.restaurantId))
    .innerJoin(shelters, eq(shelters.id, matches.shelterId))
    .leftJoin(drivers, eq(drivers.id, trips.driverId))
    .orderBy(asc(trips.createdAt));
  const funding = await db
    .select({ tripId: reservations.tripId, kind: fundingPools.kind, amount: reservations.amountCents })
    .from(reservations)
    .innerJoin(fundingPools, eq(fundingPools.id, reservations.poolId))
    .where(eq(reservations.status, "paid"));
  const mainFunder = new Map<string, { kind: string; amount: number }>();
  for (const f of funding) {
    const current = mainFunder.get(f.tripId);
    if (!current || f.amount > current.amount) mainFunder.set(f.tripId, f);
  }

  const places = new Map<string, MapPlace>();
  const routes = new Map<string, MapRoute>();
  for (const { trip, listing, restaurant, shelter } of tripRows) {
    if (trip.status !== "paid" && trip.status !== "verified" && trip.status !== "payout_pending") continue;
    places.set(restaurant.id, { id: restaurant.id, kind: "restaurant", name: restaurant.name, area: AREA[restaurant.area], lat: restaurant.lat, lng: restaurant.lng });
    const spot = shelter.confidential ? AREA_CENTRE[shelter.area] : shelter;
    places.set(shelter.id, { id: shelter.id, kind: "shelter", name: shelter.publicLabel, area: AREA[shelter.area], lat: spot.lat, lng: spot.lng });
    const key = `${restaurant.id}>${shelter.id}`;
    const route = routes.get(key) ?? { from: restaurant.id, to: shelter.id, trips: 0, meals: 0 };
    route.trips++;
    route.meals += listing.totalPortions;
    routes.set(key, route);
  }

  const rescues: RescueRow[] = tripRows.map(({ trip, listing, restaurant, shelter, driver }) => {
    const day = pacificDay(trip.createdAt);
    const delivered = trip.status === "paid" || trip.status === "verified" || trip.status === "payout_pending";
    return {
      rescueId: trip.id.slice(0, 8),
      date: day,
      week: weekStart(day),
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Los_Angeles" }).format(trip.createdAt),
      area: AREA[restaurant.area],
      restaurant: restaurant.name,
      shelter: shelter.publicLabel,
      driver: !driver ? "Unassigned" : driver.anonymous ? "Volunteer (anonymous)" : driver.name,
      outcome: delivered ? "Delivered" : trip.status === "cancelled" ? "Cancelled" : "In progress",
      meals: delivered ? listing.totalPortions : 0,
      pounds: delivered ? Math.round(listing.totalPortions * POUNDS_PER_PORTION) : 0,
      distanceKm: trip.distanceKm,
      reimbursementUsd: delivered ? trip.stipendCents / 100 : 0,
      fundedBy: FUNDER[mainFunder.get(trip.id)?.kind ?? ""] ?? "Not funded",
      minutesToDeliver:
        delivered && trip.deliveredAt ? Math.round((trip.deliveredAt.getTime() - trip.createdAt.getTime()) / 60_000) : null,
    };
  });

  const turnedAway = await db
    .select({ listing: listings, restaurant: restaurants })
    .from(listings)
    .innerJoin(restaurants, eq(restaurants.id, listings.restaurantId))
    .where(eq(listings.safetyStatus, "rejected"));
  for (const { listing, restaurant } of turnedAway) {
    const day = pacificDay(listing.createdAt);
    rescues.push({
      rescueId: listing.id.slice(0, 8),
      date: day,
      week: weekStart(day),
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Los_Angeles" }).format(listing.createdAt),
      area: AREA[restaurant.area],
      restaurant: restaurant.name,
      shelter: "None",
      driver: "None",
      outcome: "Turned away (food safety)",
      meals: 0,
      pounds: 0,
      distanceKm: 0,
      reimbursementUsd: 0,
      fundedBy: "Not funded",
      minutesToDeliver: null,
    });
  }

  const ledger = await db
    .select({ entry: ledgerEntries, pool: fundingPools })
    .from(ledgerEntries)
    .innerJoin(fundingPools, eq(fundingPools.id, ledgerEntries.poolId))
    .where(eq(ledgerEntries.status, "completed"))
    .orderBy(asc(ledgerEntries.createdAt));
  const money: MoneyRow[] = ledger.map(({ entry, pool }) => {
    const day = pacificDay(entry.createdAt);
    return {
      date: day,
      week: weekStart(day),
      direction: entry.direction === "in" ? "Money in" : "Money out",
      flow: FLOW[entry.source] ?? entry.source,
      fund: pool.label,
      area: pool.area ? AREA[pool.area] : "Any area",
      amountUsd: entry.amountCents / 100,
    };
  });

  const funds: FundRow[] = (await poolBalances(db)).map((p) => ({
    fund: p.label,
    kind: FUNDER[p.kind] ?? p.kind,
    availableUsd: p.availableCents / 100,
  }));

  return { rescues, money, funds, places: [...places.values()], routes: [...routes.values()] };
}
