import type { Db } from "@/db";
import { alerts, listings } from "@/db/schema";
import { readSurplus, type IntakeInput } from "@/agents/intake";
import { checkFoodSafety } from "@/domain/food-safety";

export async function createListing(
  db: Db,
  input: IntakeInput & { restaurantId: string; photoUrl?: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const { reading, mode } = await readSurplus(input);

  const cookedAt = new Date(now.getTime() - reading.minutesSinceCooked * 60_000);
  const readyUntil = new Date(now.getTime() + reading.readyForMinutes * 60_000);
  const safety = checkFoodSafety({
    holding: reading.holding,
    cookedAt,
    readyUntil,
    categories: reading.items.map((i) => i.category),
    aiConcerns: reading.concerns,
    now,
  });

  const [listing] = await db
    .insert(listings)
    .values({
      restaurantId: input.restaurantId,
      photoUrl: input.photoUrl,
      notes: input.notes,
      items: reading.items,
      totalPortions: reading.items.reduce((sum, i) => sum + i.portions, 0),
      allergens: reading.allergens,
      dietTags: reading.dietTags,
      holding: reading.holding,
      cookedAt,
      readyUntil: safety.safeUntil,
      safetyStatus: safety.status,
      safetyReasons: safety.reasons,
      aiRaw: { mode, reading },
      status: safety.status === "rejected" ? "cancelled" : "open",
    })
    .returning();

  if (safety.status !== "approved") {
    await db.insert(alerts).values({
      kind: "unsafe_listing",
      message:
        safety.status === "rejected"
          ? `Listing rejected by safety rules: ${safety.reasons.join(" ")}`
          : `Listing needs a food-safety check: ${safety.reasons.join(" ")}`,
    });
  }

  return { listing, reading, mode, safety };
}
