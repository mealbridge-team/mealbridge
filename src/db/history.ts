// Six weeks of past rescues for the impact dashboard. Deterministic (seeded random), fictional,
// and self-balancing: donor, general and restaurant pools receive exactly what they paid out, so
// tonight's balances are the ones seed.ts sets (sponsors, invoiced in round sums, carry a little over).
import type { Db } from "./index";
import {
  donors,
  drivers,
  fundingPools,
  ledgerEntries,
  listings,
  matches,
  reservations,
  restaurants,
  shelters,
  sponsorInvoices,
  sponsors,
  trips,
  type Area,
  type ListingItem,
} from "./schema";
import { stipendCents } from "@/domain/stipend";
import { driveMinutes, roadKm } from "@/lib/geo";

const DAYS = 42;

function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dish = { name: string; diet: string[]; allergens: string[] };

const MENUS: Record<string, Dish[]> = {
  "Lakeside Catering Co.": [
    { name: "Roast vegetable lasagna", diet: ["vegetarian"], allergens: ["dairy", "gluten"] },
    { name: "Chicken teriyaki bowls", diet: [], allergens: ["soy", "gluten"] },
    { name: "Mixed grain salad", diet: ["vegan", "vegetarian"], allergens: [] },
    { name: "Pasta primavera", diet: ["vegetarian"], allergens: ["gluten", "dairy"] },
  ],
  "Saffron & Steel Kitchen": [
    { name: "Chana masala and rice", diet: ["vegan", "vegetarian"], allergens: [] },
    { name: "Paneer tikka", diet: ["vegetarian"], allergens: ["dairy"] },
    { name: "Chicken biryani", diet: ["halal"], allergens: [] },
    { name: "Dal tadka", diet: ["vegan", "vegetarian"], allergens: [] },
  ],
  "Telegraph Avenue Tiffin": [
    { name: "Vegetable thali", diet: ["vegetarian"], allergens: ["dairy"] },
    { name: "Rajma and rice", diet: ["vegan", "vegetarian"], allergens: [] },
    { name: "Aloo paratha", diet: ["vegetarian"], allergens: ["gluten", "dairy"] },
  ],
  "Mission Comal Taqueria": [
    { name: "Bean and rice burritos", diet: ["vegetarian"], allergens: ["gluten", "dairy"] },
    { name: "Chicken tinga tacos", diet: [], allergens: [] },
    { name: "Calabacitas con arroz", diet: ["vegan", "vegetarian"], allergens: [] },
  ],
};

// Pacific evening time on a past day. -7/-8h offsets are close enough for history.
function eveningAt(daysAgo: number, minuteOfEvening: number, now: Date) {
  const day = new Date(now.getTime() - daysAgo * 86_400_000);
  const utc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 18 + 8, 0) + minuteOfEvening * 60_000;
  return new Date(utc);
}

const DONOR_NAMES = [
  "Ana P.", "Jordan K.", "Wei L.", "Fatima S.", "Diego M.", "Grace O.", "Sam W.", "Leah B.", "Arjun N.", "Noor H.",
  "Chris D.", "Elena R.", "Kofi A.", "Mina T.", "Tom F.", "Rosa V.", "Ikaika P.", "Hana Y.", "Ben C.", "Lucia G.",
];

export async function seedHistory(db: Db, now = new Date()) {
  const rand = random(20261101);
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];

  const allRestaurants = await db.select().from(restaurants);
  const allShelters = await db.select().from(shelters);
  const allDrivers = await db.select().from(drivers);
  const pools = await db.select().from(fundingPools);
  const allSponsors = await db.select().from(sponsors);
  const poolOf = (kind: string, area?: Area | null, restaurantId?: string) =>
    pools.find((p) => p.kind === kind && (area === undefined || p.area === area) && (!restaurantId || p.restaurantId === restaurantId));

  const outByPool = new Map<string, number>();
  const firstUseByPool = new Map<string, number>();
  let restaurantPlanSpend = 0;
  const RESTAURANT_PLAN_BUDGET = 2_500; // last month's $25 payment; this month's is in seed.ts

  const listingRows: (typeof listings.$inferInsert)[] = [];
  const matchRows: (typeof matches.$inferInsert)[] = [];
  const tripRows: (typeof trips.$inferInsert)[] = [];
  const reservationRows: (typeof reservations.$inferInsert)[] = [];
  const ledgerRows: (typeof ledgerEntries.$inferInsert)[] = [];

  // Stops two days back, so "tonight" on every screen only ever shows the live demo's rescues.
  for (let daysAgo = DAYS; daysAgo >= 2; daysAgo--) {
    const weekday = new Date(now.getTime() - daysAgo * 86_400_000).getUTCDay();
    const busy = weekday === 5 || weekday === 6 ? 2 : 0; // Friday and Saturday nights are busier
    const count = 2 + Math.floor(rand() * 4) + busy;

    for (let n = 0; n < count; n++) {
      const restaurant = pick(allRestaurants);
      const dish = pick(MENUS[restaurant.name] ?? MENUS["Saffron & Steel Kitchen"]);
      const portions = 12 + Math.floor(rand() * 45);
      const createdAt = eveningAt(daysAgo, Math.floor(rand() * 240), now);
      const listingId = crypto.randomUUID();
      const items: ListingItem[] = [{ name: dish.name, portions, category: "cooked_meal" }];

      // About one listing in 25 is turned away by the safety rules.
      if (rand() < 0.04) {
        listingRows.push({
          id: listingId,
          restaurantId: restaurant.id,
          items,
          totalPortions: portions,
          allergens: dish.allergens,
          dietTags: dish.diet,
          holding: "ambient",
          cookedAt: new Date(createdAt.getTime() - 3.5 * 3_600_000),
          readyUntil: createdAt,
          safetyStatus: "rejected",
          safetyReasons: ["Held unrefrigerated for more than 2 hours."],
          status: "cancelled",
          createdAt,
        });
        continue;
      }

      const candidates = allShelters.filter(
        (s) =>
          (s.area === restaurant.area || (restaurant.area === "berkeley" && s.area === "oakland")) &&
          s.dietRequirements.every((r) =>
            r === "vegetarian" ? dish.diet.includes("vegetarian") : r === "nut_free" ? !dish.allergens.includes("tree_nuts") && !dish.allergens.includes("peanuts") : dish.diet.includes(r),
          ),
      );
      const shelter = candidates.length ? pick(candidates) : allShelters.find((s) => s.area === restaurant.area)!;
      const driverPool = allDrivers.filter((d) => d.area === restaurant.area || (restaurant.area === "berkeley" && d.area === "oakland"));
      const driver = pick(driverPool.length ? driverPool : allDrivers);
      const distanceKm = Math.round(roadKm(restaurant, shelter) * 10) / 10;
      const stipend = stipendCents(distanceKm);
      const pickupAt = new Date(createdAt.getTime() + (10 + Math.floor(rand() * 20)) * 60_000);
      const deliveredAt = new Date(pickupAt.getTime() + (driveMinutes(distanceKm) + Math.floor(rand() * 10)) * 60_000);
      const cancelled = rand() < 0.04;

      listingRows.push({
        id: listingId,
        restaurantId: restaurant.id,
        items,
        totalPortions: portions,
        allergens: dish.allergens,
        dietTags: dish.diet,
        holding: rand() < 0.7 ? "hot" : "cold",
        cookedAt: new Date(createdAt.getTime() - 40 * 60_000),
        readyUntil: new Date(createdAt.getTime() + 3 * 3_600_000),
        safetyStatus: "approved",
        status: cancelled ? "cancelled" : "delivered",
        createdAt,
      });
      const matchId = crypto.randomUUID();
      matchRows.push({
        id: matchId,
        listingId,
        shelterId: shelter.id,
        score: 60 + Math.round(rand() * 35),
        reason: `${shelter.publicLabel} could use ${portions} portions tonight.`,
        createdAt,
      });
      const tripId = crypto.randomUUID();
      tripRows.push({
        id: tripId,
        matchId,
        driverId: driver.id,
        status: cancelled ? "cancelled" : "paid",
        distanceKm,
        stipendCents: stipend,
        plannedPickupAt: pickupAt,
        plannedDropoffAt: deliveredAt,
        pickedUpAt: cancelled ? null : pickupAt,
        deliveredAt: cancelled ? null : deliveredAt,
        shelterConfirmedAt: cancelled ? null : new Date(deliveredAt.getTime() + 4 * 60_000),
        shelterAccepted: cancelled ? null : true,
        verification: cancelled ? null : { photo: true, gps: true, shelterConfirmed: true, notes: [] },
        paidAt: cancelled ? null : new Date(deliveredAt.getTime() + 6 * 60_000),
        payoutBatchId: cancelled ? null : `HIST-PAYOUT-${tripId.slice(0, 8)}`,
        createdAt,
      });
      if (cancelled) continue;

      // Same order as the Treasurer: restaurant plan, area donors, sponsors, general fund. The
      // plan covers what it can and another pool the rest, so the plan is spent exactly.
      const own = poolOf("restaurant", undefined, restaurant.id);
      const parts: { pool: typeof pools[number]; cents: number }[] = [];
      if (own && restaurantPlanSpend < RESTAURANT_PLAN_BUDGET) {
        const cents = Math.min(stipend, RESTAURANT_PLAN_BUDGET - restaurantPlanSpend);
        restaurantPlanSpend += cents;
        parts.push({ pool: own, cents });
      }
      const rest = stipend - parts.reduce((s, p) => s + p.cents, 0);
      if (rest > 0) {
        const roll = rand();
        const pool =
          (roll < 0.5
            ? poolOf("donor_area", restaurant.area)
            : roll < 0.85
              ? (poolOf("sponsor", restaurant.area) ?? poolOf("sponsor", null))
              : poolOf("general", null)) ?? poolOf("general", null)!;
        parts.push({ pool, cents: rest });
      }

      for (const [i, { pool, cents }] of parts.entries()) {
        outByPool.set(pool.id, (outByPool.get(pool.id) ?? 0) + cents);
        if (!firstUseByPool.has(pool.id)) firstUseByPool.set(pool.id, daysAgo);
        reservationRows.push({ tripId, poolId: pool.id, amountCents: cents, status: "paid", createdAt });
        ledgerRows.push({
          direction: "out",
          amountCents: cents,
          poolId: pool.id,
          source: "driver_payout",
          status: "completed",
          paypalRef: `HIST-PAYOUT-${tripId.slice(0, 8)}#${i}`,
          tripId,
          createdAt: deliveredAt,
        });
      }
    }
  }

  // Money in that covers exactly what each pool paid out.
  const donorRows = DONOR_NAMES.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    email: `donor${i + 1}@example.com`,
    anonymous: i % 6 === 5,
  }));
  await db.insert(donors).values(donorRows);
  const invoiceRows: (typeof sponsorInvoices.$inferInsert)[] = [];
  let ref = 0;

  for (const pool of pools) {
    const total = outByPool.get(pool.id) ?? 0;
    if (total === 0) continue;
    const startDay = (firstUseByPool.get(pool.id) ?? DAYS) + 2;

    if (pool.kind === "restaurant") {
      for (const daysAgo of [31]) {
        ledgerRows.push({
          direction: "in",
          amountCents: 2_500,
          poolId: pool.id,
          source: "restaurant_subscription",
          status: "completed",
          paypalRef: `HIST-SALE-${++ref}`,
          restaurantId: pool.restaurantId,
          memo: "SB 1383 compliance plan payment",
          createdAt: eveningAt(daysAgo, 0, now),
        });
      }
      continue;
    }

    if (pool.kind === "sponsor") {
      const sponsor = allSponsors.find((s) => s.id === pool.sponsorId)!;
      // Sponsors are invoiced whole dollars, so their funds carry a few cents over into tonight.
      const roundUp = (cents: number) => Math.ceil(cents / 100) * 100;
      const first = roundUp(total / 2);
      for (const [i, amount] of [first, total > first ? roundUp(total - first) : 0].entries()) {
        if (amount <= 0) continue;
        const paidAt = eveningAt(i === 0 ? startDay : 20, 30, now);
        const paypalInvoiceId = `HIST-INV-${++ref}`;
        invoiceRows.push({
          sponsorId: sponsor.id,
          poolId: pool.id,
          amountCents: amount,
          memo: `Food-rescue trips funded by ${sponsor.name}`,
          paypalInvoiceId,
          invoiceNumber: `MB-${1000 + ref}`,
          status: "paid",
          paidAt,
          createdAt: new Date(paidAt.getTime() - 3 * 86_400_000),
        });
        ledgerRows.push({
          direction: "in",
          amountCents: amount,
          poolId: pool.id,
          source: "sponsor_invoice",
          status: "completed",
          paypalRef: paypalInvoiceId,
          sponsorId: sponsor.id,
          memo: `Invoice MB-${1000 + ref}`,
          createdAt: paidAt,
        });
      }
      continue;
    }

    // Donor and general pools: individual gifts of $5-$40, the last one topping up exactly.
    let remaining = total;
    while (remaining > 0) {
      const amount = Math.min(remaining, (5 + Math.floor(rand() * 8) * 5) * 100);
      remaining -= amount;
      const daysAgo = Math.max(1, Math.floor(rand() * startDay));
      ledgerRows.push({
        direction: "in",
        amountCents: amount,
        poolId: pool.id,
        source: "donation",
        status: "completed",
        paypalRef: `HIST-CAP-${++ref}`,
        donorId: pick(donorRows).id,
        createdAt: eveningAt(daysAgo, Math.floor(rand() * 300) - 120, now),
      });
    }
  }

  const chunks = <T,>(rows: T[], size = 200) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, i * size + size));
  for (const rows of chunks(listingRows)) await db.insert(listings).values(rows);
  for (const rows of chunks(matchRows)) await db.insert(matches).values(rows);
  for (const rows of chunks(tripRows)) await db.insert(trips).values(rows);
  for (const rows of chunks(reservationRows)) await db.insert(reservations).values(rows);
  for (const rows of chunks(ledgerRows)) await db.insert(ledgerEntries).values(rows);
  if (invoiceRows.length) await db.insert(sponsorInvoices).values(invoiceRows);
}
