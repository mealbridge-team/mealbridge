import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, runMigrations } from "@/db";
import { resetDemoData } from "@/db/seed";
import { shelters, trips } from "@/db/schema";
import { recordDropoff, recordPickup, recordShelterConfirmation } from "./delivery";
import { createListing } from "./listings";
import { matchListing } from "./pipeline";

// The AI photo check says the drop-off photo doesn't show the listed food.
vi.mock("@/agents/verifier", () => ({
  checkDropoffPhoto: vi.fn(async () => ({ showsFood: false, consistentWithListing: false, notes: "Photo shows a blank screen." })),
}));

const db = getDb();
const evening = new Date("2026-11-05T04:00:00Z");
const at = (m: number) => new Date(evening.getTime() + m * 60_000);

beforeEach(async () => {
  await runMigrations(db);
});

describe("verification keeps the AI photo verdict", () => {
  it("still holds the payout when the shelter confirms after the photo was flagged", async () => {
    const { restaurants } = await resetDemoData(db);
    const { listing } = await createListing(db, { restaurantId: restaurants.saffron.id, notes: "40 portions chicken biryani, kept hot", now: evening });
    const outcome = await matchListing(db, listing.id, evening);
    if (outcome.kind !== "matched") throw new Error("expected a match");
    const [trip] = await db.select().from(trips).where(eq(trips.id, outcome.tripId));
    const [shelter] = await db.select().from(shelters).where(eq(shelters.name, outcome.shelterName));

    await recordPickup(db, trip.id, trip.driverId!, { data: new Uint8Array([1]), mediaType: "image/jpeg" }, at(15));
    await recordDropoff(
      db,
      trip.id,
      trip.driverId!,
      { photo: { data: new Uint8Array([2]), mediaType: "image/jpeg" }, lat: shelter.lat, lng: shelter.lng, simulatedLocation: true },
      at(35),
    );
    await recordShelterConfirmation(db, trip.id, true, at(36));

    const [held] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(held.status).toBe("needs_review");
    expect(held.verification?.photo).toBe(false);
    expect(held.verification?.notes.join(" ")).toMatch(/blank screen/);
  });
});
