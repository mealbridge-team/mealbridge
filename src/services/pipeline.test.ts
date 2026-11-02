import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db";
import { resetDemoData } from "@/db/seed";
import { alerts, drivers, shelters, trips } from "@/db/schema";
import { approveDelivery, recordDropoff, recordPickup, recordShelterConfirmation } from "./delivery";
import { createListing } from "./listings";
import { matchListing, reassignTrip } from "./pipeline";

const db = getDb();
const evening = new Date("2026-11-05T04:00:00Z"); // 8:00pm in California
const at = (minutes: number) => new Date(evening.getTime() + minutes * 60_000);
const photo = (seed: number) => ({ data: new Uint8Array([seed, 1, 2, 3]), mediaType: "image/jpeg" });

let seeded: Awaited<ReturnType<typeof resetDemoData>>;
beforeEach(async () => {
  await runMigrations(db);
  seeded = await resetDemoData(db);
});

async function postAndMatch(notes: string) {
  const { listing } = await createListing(db, {
    restaurantId: seeded.restaurants.saffron.id,
    notes,
    now: evening,
  });
  const outcome = await matchListing(db, listing.id, evening);
  if (outcome.kind !== "matched") throw new Error(`expected a match, got ${outcome.kind}`);
  const [trip] = await db.select().from(trips).where(eq(trips.id, outcome.tripId));
  const [shelter] = await db
    .select()
    .from(shelters)
    .where(eq(shelters.name, outcome.shelterName));
  return { outcome, trip, shelter };
}

describe("one rescue, end to end (demo mode)", () => {
  it("matches, funds, dispatches, verifies three signals and pays the driver", async () => {
    const { outcome, trip, shelter } = await postAndMatch("40 portions chicken biryani, kept hot");
    expect(outcome).toMatchObject({ funded: true });
    expect(outcome.driverName).toBeTruthy();
    expect(trip.status).toBe("assigned");

    await recordPickup(db, trip.id, trip.driverId!, photo(1), at(15));
    await recordDropoff(
      db,
      trip.id,
      trip.driverId!,
      { photo: photo(2), lat: shelter.lat, lng: shelter.lng, simulatedLocation: true },
      at(35),
    );
    // Not paid until the shelter confirms.
    expect((await db.select().from(trips).where(eq(trips.id, trip.id)))[0].status).toBe("delivered");

    await recordShelterConfirmation(db, trip.id, true, at(36));
    const [done] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(done.status).toBe("paid");
    expect(done.verification).toMatchObject({ photo: true, gps: true, shelterConfirmed: true });
  });

  it("holds a delivery reported far from the shelter until a coordinator approves", async () => {
    const { trip } = await postAndMatch("30 portions veg pasta, kept hot");
    await recordPickup(db, trip.id, trip.driverId!, photo(3), at(15));
    await recordDropoff(
      db,
      trip.id,
      trip.driverId!,
      { photo: photo(4), lat: 37.9, lng: -122.1, simulatedLocation: true },
      at(35),
    );
    await recordShelterConfirmation(db, trip.id, true, at(36));

    let [held] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(held.status).toBe("needs_review");
    const open = await db.select().from(alerts).where(eq(alerts.tripId, trip.id));
    expect(open.some((a) => a.kind === "verification_failed" && !a.resolved)).toBe(true);

    await approveDelivery(db, trip.id);
    [held] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(held.status).toBe("paid");
  });

  it("rejects a reused photo", async () => {
    const { trip, shelter } = await postAndMatch("25 portions rice and beans, kept hot");
    await recordPickup(db, trip.id, trip.driverId!, photo(5), at(15));
    await recordDropoff(
      db,
      trip.id,
      trip.driverId!,
      { photo: photo(5), lat: shelter.lat, lng: shelter.lng, simulatedLocation: true },
      at(35),
    );
    await recordShelterConfirmation(db, trip.id, true, at(36));
    const [held] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(held.status).toBe("needs_review");
    expect(held.verification?.notes.join(" ")).toMatch(/already used/);
  });

  it("reassigns to another driver when the first one drops out", async () => {
    const { trip } = await postAndMatch("40 portions chicken biryani, kept hot");
    const first = trip.driverId;
    const result = await reassignTrip(db, trip.id, evening);
    const [after] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(after.status).toBe("assigned");
    expect(after.driverId).not.toBe(first);
    const [next] = await db.select().from(drivers).where(eq(drivers.id, after.driverId!));
    expect(result?.next?.driverName).toBe(next.name);
  });
});

describe("shelter and driver availability", () => {
  it("never matches a shelter that paused deliveries for the night", async () => {
    const first = await postAndMatch("30 portions chicken biryani, kept hot");
    await db.update(shelters).set({ acceptingFood: false }).where(eq(shelters.id, first.shelter.id));

    const { listing } = await createListing(db, { restaurantId: seeded.restaurants.saffron.id, notes: "30 portions chicken biryani, kept hot", now: evening });
    const outcome = await matchListing(db, listing.id, evening);
    if (outcome.kind === "matched") expect(outcome.shelterName).not.toBe(first.shelter.name);
  });

  it("only books drivers who are on duty", async () => {
    await db.update(drivers).set({ available: false });
    const { listing } = await createListing(db, { restaurantId: seeded.restaurants.saffron.id, notes: "30 portions veg pasta, kept hot", now: evening });
    const outcome = await matchListing(db, listing.id, evening);
    expect(outcome).toMatchObject({ kind: "matched", funded: true });
    const [trip] = await db.select().from(trips).where(eq(trips.id, (outcome as { tripId: string }).tripId));
    expect(trip.driverId).toBeNull();
    expect(trip.status).toBe("funded");
  });
});
