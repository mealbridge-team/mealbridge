import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { listings, matches, restaurants, shelters, trips } from "@/db/schema";

// SB 1383 recordkeeping: what was donated, when, how much, and to which food recovery
// organization. The compliance plan's main deliverable, as a CSV the restaurant can file.
const POUNDS_PER_PORTION = 0.75;

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/restaurants/[id]/records">) {
  const { id } = await ctx.params;
  const db = getDb();
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
  if (!restaurant) return new Response("Unknown restaurant", { status: 404 });

  const rows = await db
    .select({ trip: trips, listing: listings, shelter: shelters })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .innerJoin(shelters, eq(shelters.id, matches.shelterId))
    .where(and(eq(listings.restaurantId, id), inArray(trips.status, ["paid", "verified", "payout_pending"])))
    .orderBy(desc(trips.deliveredAt));

  const header = [
    "Date delivered",
    "Food donated",
    "Portions",
    "Estimated pounds",
    "Food recovery organization",
    "Organization location",
    "Transported by",
    "Verified",
  ];
  const lines = rows.map(({ trip, listing, shelter }) =>
    [
      trip.deliveredAt?.toISOString().slice(0, 10),
      listing.items.map((i) => i.name).join("; "),
      listing.totalPortions,
      Math.round(listing.totalPortions * POUNDS_PER_PORTION),
      shelter.confidential ? `Confidential shelter (${shelter.publicLabel})` : shelter.name,
      shelter.confidential ? shelter.publicLabel : shelter.address,
      "MealBridge volunteer driver",
      trip.shelterAccepted ? "Shelter confirmed receipt" : "Photo and GPS",
    ]
      .map(csvCell)
      .join(","),
  );
  const filename = `${restaurant.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-sb1383-records.csv`;
  return new Response([header.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
