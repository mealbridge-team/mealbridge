import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { fundingPools, listings, matches, reservations, restaurants, sponsorInvoices, sponsors, trips } from "@/db/schema";
import { poolBalances } from "./treasury";

// Everything a sponsor (a company or a city grant) sees in its portal: what's left in its fund,
// what the money has already done, and its PayPal invoices.
export async function sponsorOverview(db: Db, sponsorId: string) {
  const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, sponsorId));
  if (!sponsor) return null;

  const pools = await db.select().from(fundingPools).where(eq(fundingPools.sponsorId, sponsorId));
  const poolIds = pools.map((p) => p.id);
  const balances = (await poolBalances(db)).filter((b) => poolIds.includes(b.id));

  const funded = poolIds.length
    ? await db
        .select({
          tripId: trips.id,
          amountCents: reservations.amountCents,
          portions: listings.totalPortions,
          restaurant: restaurants.name,
          area: restaurants.area,
          paidAt: trips.paidAt,
        })
        .from(reservations)
        .innerJoin(trips, eq(trips.id, reservations.tripId))
        .innerJoin(matches, eq(matches.id, trips.matchId))
        .innerJoin(listings, eq(listings.id, matches.listingId))
        .innerJoin(restaurants, eq(restaurants.id, listings.restaurantId))
        .where(and(inArray(reservations.poolId, poolIds), eq(reservations.status, "paid")))
        .orderBy(desc(trips.paidAt))
    : [];

  const invoices = await db
    .select()
    .from(sponsorInvoices)
    .where(eq(sponsorInvoices.sponsorId, sponsorId))
    .orderBy(desc(sponsorInvoices.createdAt));

  return {
    sponsor,
    availableCents: balances.reduce((s, b) => s + b.availableCents, 0),
    areas: [...new Set(pools.map((p) => p.area).filter((a): a is NonNullable<typeof a> => a != null))],
    rescues: funded.length,
    meals: funded.reduce((s, f) => s + f.portions, 0),
    spentCents: funded.reduce((s, f) => s + f.amountCents, 0),
    recent: funded.slice(0, 8),
    invoices,
  };
}
