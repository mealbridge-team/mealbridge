import { describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db";
import { resetDemoData } from "@/db/seed";
import { createListing } from "@/services/listings";
import { demoReading, intakeSchema } from "./intake";

describe("intake (demo mode, no Gemini key)", () => {
  it("reads portions, diet and holding from a note", () => {
    const r = demoReading("40 portions veg biryani with paneer, kept hot");
    expect(intakeSchema.parse(r)).toBeTruthy();
    expect(r.items[0].portions).toBe(40);
    expect(r.dietTags).toContain("vegetarian");
    expect(r.allergens).toContain("dairy");
    expect(r.holding).toBe("hot");
  });

  it("stores an approved listing with the safety window applied", async () => {
    const db = getDb();
    await runMigrations(db);
    const { restaurants } = await resetDemoData(db);
    const now = new Date("2026-11-05T05:00:00Z");

    const { listing, mode } = await createListing(db, {
      restaurantId: restaurants.saffron.id,
      notes: "40 portions veg biryani, kept hot",
      now,
    });
    expect(mode).toBe("demo");
    expect(listing.safetyStatus).toBe("approved");
    expect(listing.totalPortions).toBe(40);
    // Cooked 60 min ago and held hot (4h limit), restaurant can hold 120 min: readyUntil wins.
    expect(listing.readyUntil.getTime()).toBe(now.getTime() + 120 * 60_000);
  });
});
