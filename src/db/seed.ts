// Resets the database to the demo state: one Bay Area evening. All businesses, shelters and
// people below are fictional. Run with `npm run setup`.
import { sql } from "drizzle-orm";
import { getDb, runMigrations, type Db } from "./index";
import {
  alerts,
  donors,
  drivers,
  fundingPools,
  ledgerEntries,
  listings,
  matches,
  needs,
  paypalEvents,
  reservations,
  restaurants,
  shelters,
  sponsors,
  trips,
} from "./schema";

export async function resetDemoData(db: Db) {
  await db.execute(
    sql`truncate table alerts, paypal_events, ledger_entries, reservations, trips, matches, listings,
        needs, funding_pools, sponsors, donors, drivers, shelters, restaurants restart identity cascade`,
  );

  const [lakeside, saffron, telegraph, mission] = await db
    .insert(restaurants)
    .values([
      {
        name: "Lakeside Catering Co.",
        address: "Grand Ave, Oakland, CA",
        area: "oakland",
        lat: 37.8113,
        lng: -122.2512,
        sb1383Tier: "tier2",
        plan: "compliance",
        subscriptionStatus: "ACTIVE",
      },
      {
        name: "Saffron & Steel Kitchen",
        address: "Broadway, Oakland, CA",
        area: "oakland",
        lat: 37.8044,
        lng: -122.2711,
        sb1383Tier: "tier2",
      },
      {
        name: "Telegraph Avenue Tiffin",
        address: "Telegraph Ave, Berkeley, CA",
        area: "berkeley",
        lat: 37.8659,
        lng: -122.2588,
      },
      {
        name: "Mission Comal Taqueria",
        address: "Valencia St, San Francisco, CA",
        area: "san-francisco",
        lat: 37.7599,
        lng: -122.4214,
      },
    ])
    .returning();

  await db.insert(shelters).values([
    {
      name: "Eastbay Harbor Shelter",
      area: "oakland",
      publicLabel: "Oakland, West",
      address: "Mandela Pkwy, Oakland, CA",
      lat: 37.8115,
      lng: -122.2946,
      capacityPortions: 80,
      dietRequirements: [],
      opensAt: "17:00",
      closesAt: "23:00",
    },
    {
      // Confidential (domestic-violence) shelter: only the assigned driver sees the address.
      name: "Haven House",
      area: "oakland",
      publicLabel: "Oakland, East",
      address: "Address shared with assigned driver only",
      lat: 37.7749,
      lng: -122.2241,
      confidential: true,
      capacityPortions: 30,
      dietRequirements: ["nut_free"],
      opensAt: "16:00",
      closesAt: "22:00",
    },
    {
      name: "Northside Community Kitchen",
      area: "berkeley",
      publicLabel: "Berkeley, South",
      address: "Shattuck Ave, Berkeley, CA",
      lat: 37.8591,
      lng: -122.2678,
      capacityPortions: 50,
      dietRequirements: ["vegetarian"],
      opensAt: "18:00",
      closesAt: "02:00",
    },
    {
      name: "Mission Neighbors Dining Hall",
      area: "san-francisco",
      publicLabel: "San Francisco, Mission",
      address: "Mission St, San Francisco, CA",
      lat: 37.7625,
      lng: -122.4192,
      capacityPortions: 120,
      dietRequirements: [],
      opensAt: "17:30",
      closesAt: "23:30",
    },
  ]);

  await db.insert(drivers).values([
    {
      name: "Maya R.",
      paypalEmail: process.env.DEMO_DRIVER_1_EMAIL ?? "maya.driver@example.com",
      vehicle: "Hatchback",
      area: "oakland",
      lat: 37.8024,
      lng: -122.2585,
    },
    {
      name: "Luis G.",
      payoutWallet: "venmo",
      venmoPhone: process.env.DEMO_DRIVER_2_PHONE ?? "4085550142",
      vehicle: "Minivan",
      area: "oakland",
      lat: 37.7956,
      lng: -122.2788,
    },
    {
      name: "Priya S.",
      paypalEmail: process.env.DEMO_DRIVER_3_EMAIL ?? "priya.driver@example.com",
      vehicle: "Cargo bike",
      area: "berkeley",
      lat: 37.8716,
      lng: -122.2727,
    },
    {
      name: "Sam T.",
      paypalEmail: "sam.driver@example.com",
      vehicle: "Sedan",
      area: "san-francisco",
      lat: 37.7651,
      lng: -122.4302,
      anonymous: true,
    },
  ]);

  const [ana] = await db
    .insert(donors)
    .values([
      { name: "Ana P.", email: "ana.donor@example.com" },
      { name: "Anonymous donor", email: "anon.donor@example.com", anonymous: true },
    ])
    .returning();

  const [cityGrant, corporate] = await db
    .insert(sponsors)
    .values([
      { name: "Bayshore City Food Recovery Grant", kind: "city", contactEmail: "grants@example.com" },
      { name: "Brightline Logistics", kind: "corporate", contactEmail: "csr@example.com" },
    ])
    .returning();

  const pools = await db
    .insert(fundingPools)
    .values([
      { kind: "restaurant", label: `${lakeside.name} compliance plan`, restaurantId: lakeside.id },
      { kind: "donor_area", label: "Donors: Oakland", area: "oakland" },
      { kind: "donor_area", label: "Donors: Berkeley", area: "berkeley" },
      { kind: "donor_area", label: "Donors: San Francisco", area: "san-francisco" },
      { kind: "sponsor", label: cityGrant.name, area: "oakland", sponsorId: cityGrant.id },
      { kind: "sponsor", label: corporate.name, sponsorId: corporate.id },
      { kind: "general", label: "General rescue fund" },
    ])
    .returning();
  const pool = (label: string) => pools.find((p) => p.label === label)!.id;

  await db.insert(ledgerEntries).values([
    {
      direction: "in",
      status: "completed",
      amountCents: 2500,
      poolId: pool(`${lakeside.name} compliance plan`),
      source: "restaurant_subscription",
      paypalRef: "SEED-SUB-1",
      restaurantId: lakeside.id,
    },
    {
      direction: "in",
      status: "completed",
      amountCents: 1500,
      poolId: pool("Donors: Oakland"),
      source: "donation",
      paypalRef: "SEED-DON-1",
      donorId: ana.id,
    },
    {
      direction: "in",
      status: "completed",
      amountCents: 1000,
      poolId: pool("Donors: San Francisco"),
      source: "donation",
      paypalRef: "SEED-DON-2",
    },
    {
      direction: "in",
      status: "completed",
      amountCents: 12000,
      poolId: pool(cityGrant.name),
      source: "sponsor_invoice",
      paypalRef: "SEED-INV-1",
      sponsorId: cityGrant.id,
    },
    {
      direction: "in",
      status: "completed",
      amountCents: 800,
      poolId: pool(corporate.name),
      source: "sponsor_invoice",
      paypalRef: "SEED-INV-2",
      sponsorId: corporate.id,
    },
  ]);

  const [harbor] = await db.select().from(shelters).where(sql`name = 'Eastbay Harbor Shelter'`);
  await db.insert(needs).values([
    { shelterId: harbor.id, item: "Infant formula (powder)", quantity: 6, urgency: "high" },
    { shelterId: harbor.id, item: "Hygiene kits", quantity: 20, urgency: "medium" },
  ]);

  return { restaurants: { lakeside, saffron, telegraph, mission } };
}

async function main() {
  const db = getDb();
  await runMigrations(db);
  await resetDemoData(db);
  console.log("MealBridge demo data loaded.");
  process.exit(0);
}

// Only run when executed directly, not when imported by tests or the demo-reset route.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("src/db/seed.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// Silence unused-import lint for tables only referenced by the truncate statement.
void [alerts, listings, matches, paypalEvents, reservations, trips];
