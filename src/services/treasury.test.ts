import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db";
import { resetDemoData } from "@/db/seed";
import { drivers, fundingPools, ledgerEntries, listings, matches, shelters, trips } from "@/db/schema";
import { encodeCustomId, processPayPalEvent } from "./webhooks";
import { fundTrip, payTrip, poolBalances } from "./treasury";

const db = getDb();

async function makeTrip(restaurantName: string, stipend: number) {
  const { restaurants } = await resetOnce();
  const restaurant = Object.values(restaurants).find((r) => r.name === restaurantName)!;
  const [shelter] = await db.select().from(shelters).limit(1);
  const [driver] = await db.select().from(drivers).limit(1);
  const [listing] = await db
    .insert(listings)
    .values({
      restaurantId: restaurant.id,
      totalPortions: 40,
      holding: "hot",
      cookedAt: new Date(),
      readyUntil: new Date(Date.now() + 2 * 3_600_000),
      safetyStatus: "approved",
    })
    .returning();
  const [match] = await db
    .insert(matches)
    .values({ listingId: listing.id, shelterId: shelter.id, score: 80, reason: "test" })
    .returning();
  const [trip] = await db
    .insert(trips)
    .values({
      matchId: match.id,
      driverId: driver.id,
      distanceKm: 4,
      stipendCents: stipend,
      plannedPickupAt: new Date(),
      plannedDropoffAt: new Date(),
    })
    .returning();
  return trip;
}

let seeded: Awaited<ReturnType<typeof resetDemoData>> | null = null;
async function resetOnce() {
  seeded ??= await resetDemoData(db);
  return seeded;
}

beforeEach(async () => {
  await runMigrations(db);
  seeded = null;
});

const available = async (label: string) =>
  (await poolBalances(db)).find((p) => p.label === label)!.availableCents;

describe("trip funding and payout", () => {
  it("reserves from the restaurant's plan first, then pays the driver and settles the ledger", async () => {
    const trip = await makeTrip("Lakeside Catering Co.", 3000);

    expect(await fundTrip(db, trip.id)).toEqual({ funded: true });
    expect(await available("Lakeside Catering Co. compliance plan")).toBe(0);
    expect(await available("Donors: Oakland")).toBe(1000); // 1500 - 500

    await db.update(trips).set({ status: "verified" }).where(eq(trips.id, trip.id));
    const payout = await payTrip(db, trip.id);
    expect(payout?.batchId).toMatch(/^MOCK-PAYOUT/);

    const [paid] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(paid.status).toBe("paid");
    const out = await db.select().from(ledgerEntries).where(eq(ledgerEntries.tripId, trip.id));
    expect(out.reduce((s, e) => s + e.amountCents, 0)).toBe(3000);
    expect(out.every((e) => e.status === "completed")).toBe(true);

    // Paying twice does nothing.
    expect(await payTrip(db, trip.id)).toBeNull();
  });

  it("holds an unfunded trip until a donation arrives, and ignores a replayed webhook", async () => {
    // Berkeley has no donors or city grant; the corporate pool has only $8.
    const trip = await makeTrip("Telegraph Avenue Tiffin", 1200);
    expect(await fundTrip(db, trip.id)).toEqual({ funded: false });

    const [berkeleyDonors] = await db
      .select()
      .from(fundingPools)
      .where(eq(fundingPools.label, "Donors: Berkeley"));
    const event = {
      id: "WH-TEST-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "CAPTURE-1", custom_id: encodeCustomId({ poolId: berkeleyDonors.id }), amount: { value: "5.00" } },
    };

    expect(await processPayPalEvent(db, event)).toBe("processed");
    // The donation funds the waiting trip and Dispatch books a driver straight away.
    const [funded] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(funded.status).toBe("assigned");

    expect(await processPayPalEvent(db, event)).toBe("duplicate");
    const ins = await db.select().from(ledgerEntries).where(eq(ledgerEntries.paypalRef, "CAPTURE-1"));
    expect(ins).toHaveLength(1);
  });
});

