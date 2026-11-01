import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Money is always stored as integer cents (USD).

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export type Area = "oakland" | "berkeley" | "san-francisco";

export const restaurants = pgTable("restaurants", {
  id: id(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  area: text("area").$type<Area>().notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  // California SB 1383 edible-food-generator tier; drives the compliance-plan pitch.
  sb1383Tier: text("sb1383_tier").$type<"tier1" | "tier2" | "none">().notNull().default("none"),
  plan: text("plan").$type<"free" | "compliance">().notNull().default("free"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  createdAt: createdAt(),
});

export const shelters = pgTable("shelters", {
  id: id(),
  name: text("name").notNull(),
  area: text("area").$type<Area>().notNull(),
  // Public label only; exact location is private for confidential shelters.
  publicLabel: text("public_label").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  confidential: boolean("confidential").notNull().default(false),
  capacityPortions: integer("capacity_portions").notNull(),
  // Hard requirements every listing sent here must satisfy, e.g. "vegetarian", "halal", "nut_free".
  dietRequirements: text("diet_requirements").array().notNull().default([]),
  opensAt: text("opens_at").notNull(), // "HH:MM" local time
  closesAt: text("closes_at").notNull(),
  createdAt: createdAt(),
});

export const drivers = pgTable("drivers", {
  id: id(),
  name: text("name").notNull(),
  payoutWallet: text("payout_wallet").$type<"paypal" | "venmo">().notNull().default("paypal"),
  paypalEmail: text("paypal_email"),
  venmoPhone: text("venmo_phone"),
  vehicle: text("vehicle").notNull(),
  area: text("area").$type<Area>().notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  available: boolean("available").notNull().default(true),
  rating: real("rating").notNull().default(5),
  anonymous: boolean("anonymous").notNull().default(false),
  createdAt: createdAt(),
});

export const donors = pgTable("donors", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  anonymous: boolean("anonymous").notNull().default(false),
  createdAt: createdAt(),
});

export const sponsors = pgTable("sponsors", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").$type<"city" | "corporate">().notNull(),
  contactEmail: text("contact_email").notNull(),
  createdAt: createdAt(),
});

// Every dollar in lands in exactly one pool; trips reserve from pools before dispatch.
export const fundingPools = pgTable("funding_pools", {
  id: id(),
  kind: text("kind").$type<"restaurant" | "donor_area" | "sponsor" | "general">().notNull(),
  label: text("label").notNull(),
  area: text("area").$type<Area>(), // null = any area
  restaurantId: text("restaurant_id").references(() => restaurants.id),
  sponsorId: text("sponsor_id").references(() => sponsors.id),
  createdAt: createdAt(),
});

export type ListingItem = { name: string; portions: number; category: string };

export const listings = pgTable(
  "listings",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    photoUrl: text("photo_url"),
    notes: text("notes"),
    items: jsonb("items").$type<ListingItem[]>().notNull().default([]),
    totalPortions: integer("total_portions").notNull(),
    allergens: text("allergens").array().notNull().default([]),
    dietTags: text("diet_tags").array().notNull().default([]),
    holding: text("holding").$type<"hot" | "cold" | "ambient">().notNull(),
    cookedAt: timestamp("cooked_at", { withTimezone: true }).notNull(),
    readyUntil: timestamp("ready_until", { withTimezone: true }).notNull(),
    safetyStatus: text("safety_status").$type<"approved" | "review" | "rejected">().notNull(),
    safetyReasons: text("safety_reasons").array().notNull().default([]),
    aiRaw: jsonb("ai_raw"),
    status: text("status")
      .$type<"open" | "matched" | "delivered" | "expired" | "cancelled">()
      .notNull()
      .default("open"),
    createdAt: createdAt(),
  },
  (t) => [index("listings_status_idx").on(t.status)],
);

export const matches = pgTable("matches", {
  id: id(),
  listingId: text("listing_id")
    .notNull()
    .references(() => listings.id),
  shelterId: text("shelter_id")
    .notNull()
    .references(() => shelters.id),
  score: real("score").notNull(),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export type TripStatus =
  | "unfunded"
  | "funded"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "needs_review"
  | "verified"
  | "payout_pending"
  | "paid"
  | "cancelled";

export type Verification = {
  photo: boolean;
  gps: boolean;
  shelterConfirmed: boolean;
  notes: string[];
};

export const trips = pgTable(
  "trips",
  {
    id: id(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id),
    driverId: text("driver_id").references(() => drivers.id),
    status: text("status").$type<TripStatus>().notNull().default("unfunded"),
    distanceKm: real("distance_km").notNull(),
    stipendCents: integer("stipend_cents").notNull(),
    plannedPickupAt: timestamp("planned_pickup_at", { withTimezone: true }).notNull(),
    plannedDropoffAt: timestamp("planned_dropoff_at", { withTimezone: true }).notNull(),
    pickupPhotoUrl: text("pickup_photo_url"),
    dropoffPhotoUrl: text("dropoff_photo_url"),
    dropoffLat: doublePrecision("dropoff_lat"),
    dropoffLng: doublePrecision("dropoff_lng"),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    shelterConfirmedAt: timestamp("shelter_confirmed_at", { withTimezone: true }),
    shelterAccepted: boolean("shelter_accepted"),
    verification: jsonb("verification").$type<Verification>(),
    payoutBatchId: text("payout_batch_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // Light live tracking: the driver's last shared position while the trip is on the road.
    lastLat: doublePrecision("last_lat"),
    lastLng: doublePrecision("last_lng"),
    lastPositionAt: timestamp("last_position_at", { withTimezone: true }),
    positionSimulated: boolean("position_simulated").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("trips_status_idx").on(t.status)],
);

export const reservations = pgTable(
  "reservations",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id),
    poolId: text("pool_id")
      .notNull()
      .references(() => fundingPools.id),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").$type<"held" | "paid" | "released">().notNull().default("held"),
    createdAt: createdAt(),
  },
  (t) => [index("reservations_pool_idx").on(t.poolId)],
);

export type LedgerSource =
  | "donation"
  | "sponsor_invoice"
  | "restaurant_subscription"
  | "driver_payout"
  | "gapfill_purchase"
  | "refund";

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    direction: text("direction").$type<"in" | "out">().notNull(),
    amountCents: integer("amount_cents").notNull(),
    poolId: text("pool_id")
      .notNull()
      .references(() => fundingPools.id),
    source: text("source").$type<LedgerSource>().notNull(),
    status: text("status").$type<"pending" | "completed" | "failed">().notNull(),
    // PayPal capture / payout item / invoice id. Unique so a replayed webhook never double-counts.
    paypalRef: text("paypal_ref"),
    tripId: text("trip_id").references(() => trips.id),
    donorId: text("donor_id").references(() => donors.id),
    sponsorId: text("sponsor_id").references(() => sponsors.id),
    restaurantId: text("restaurant_id").references(() => restaurants.id),
    memo: text("memo"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ledger_paypal_ref_uq").on(t.source, t.paypalRef),
    index("ledger_pool_idx").on(t.poolId),
  ],
);

// A donor checkout we created. The amount and destination live here, never in the browser.
export const donationOrders = pgTable("donation_orders", {
  orderId: text("order_id").primaryKey(),
  poolId: text("pool_id")
    .notNull()
    .references(() => fundingPools.id),
  donorId: text("donor_id")
    .notNull()
    .references(() => donors.id),
  amountCents: integer("amount_cents").notNull(),
  // Optional: the specific unfunded trip the donor chose to cover.
  tripId: text("trip_id").references(() => trips.id),
  status: text("status").$type<"created" | "captured" | "failed">().notNull().default("created"),
  captureId: text("capture_id"),
  createdAt: createdAt(),
});

// Raw PayPal webhook events, keyed by PayPal's event id for idempotency.
export const paypalEvents = pgTable("paypal_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  receivedAt: createdAt(),
});

// A PayPal invoice sent to a sponsor or city grant. Paid money lands in the sponsor's pool.
export const sponsorInvoices = pgTable("sponsor_invoices", {
  id: id(),
  sponsorId: text("sponsor_id")
    .notNull()
    .references(() => sponsors.id),
  poolId: text("pool_id")
    .notNull()
    .references(() => fundingPools.id),
  amountCents: integer("amount_cents").notNull(),
  memo: text("memo").notNull(),
  paypalInvoiceId: text("paypal_invoice_id").notNull().unique(),
  invoiceNumber: text("invoice_number").notNull(),
  payerViewUrl: text("payer_view_url"),
  status: text("status").$type<"sent" | "paid" | "cancelled">().notNull().default("sent"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Small key/value store for ids created once in PayPal, e.g. the compliance plan's billing plan.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const needs = pgTable("needs", {
  id: id(),
  shelterId: text("shelter_id")
    .notNull()
    .references(() => shelters.id),
  item: text("item").notNull(),
  quantity: integer("quantity").notNull(),
  urgency: text("urgency").$type<"low" | "medium" | "high">().notNull(),
  status: text("status").$type<"open" | "filled">().notNull().default("open"),
  createdAt: createdAt(),
});

export const alerts = pgTable("alerts", {
  id: id(),
  kind: text("kind")
    .$type<
      | "unfunded_trip"
      | "low_fund"
      | "late_driver"
      | "verification_failed"
      | "unsafe_listing"
      | "payout_failed"
      | "payout_unclaimed"
    >()
    .notNull(),
  message: text("message").notNull(),
  tripId: text("trip_id").references(() => trips.id),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: createdAt(),
});
