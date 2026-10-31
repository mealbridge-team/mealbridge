import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  alerts,
  drivers,
  fundingPools,
  ledgerEntries,
  listings,
  matches,
  reservations,
  restaurants,
  trips,
  type LedgerSource,
} from "@/db/schema";
import { allocateTrip, type PoolBalance } from "@/domain/treasurer";
import { formatUsd } from "@/domain/stipend";
import { createPayout, type PayoutReceiver } from "@/paypal/api";
import { paypalMode } from "@/paypal/client";

// Available = money in (completed) - money out (pending or completed) - money held for trips.
export async function poolBalances(db: Db): Promise<(PoolBalance & { label: string })[]> {
  const pools = await db.select().from(fundingPools);
  const ledger = await db
    .select({
      poolId: ledgerEntries.poolId,
      direction: ledgerEntries.direction,
      status: ledgerEntries.status,
      total: sql<string>`sum(${ledgerEntries.amountCents})`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.poolId, ledgerEntries.direction, ledgerEntries.status);
  const held = await db
    .select({ poolId: reservations.poolId, total: sql<string>`sum(${reservations.amountCents})` })
    .from(reservations)
    .where(eq(reservations.status, "held"))
    .groupBy(reservations.poolId);

  return pools.map((p) => {
    let available = 0;
    for (const row of ledger.filter((r) => r.poolId === p.id)) {
      const amount = Number(row.total);
      if (row.direction === "in" && row.status === "completed") available += amount;
      if (row.direction === "out" && row.status !== "failed") available -= amount;
    }
    available -= Number(held.find((h) => h.poolId === p.id)?.total ?? 0);
    return {
      id: p.id,
      label: p.label,
      kind: p.kind,
      area: p.area,
      restaurantId: p.restaurantId,
      availableCents: available,
    };
  });
}

// Records money in. Idempotent on (source, paypalRef) so a webhook replay is a no-op.
export async function recordIncoming(
  db: Db,
  entry: {
    poolId: string;
    amountCents: number;
    source: LedgerSource;
    paypalRef: string;
    donorId?: string;
    sponsorId?: string;
    restaurantId?: string;
    memo?: string;
  },
): Promise<boolean> {
  const inserted = await db
    .insert(ledgerEntries)
    .values({ ...entry, direction: "in", status: "completed" })
    .onConflictDoNothing()
    .returning({ id: ledgerEntries.id });
  return inserted.length > 0;
}

async function tripContext(db: Db, tripId: string) {
  const [row] = await db
    .select({ trip: trips, restaurantId: listings.restaurantId, area: restaurants.area })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .innerJoin(restaurants, eq(restaurants.id, listings.restaurantId))
    .where(eq(trips.id, tripId));
  if (!row) throw new Error(`Trip ${tripId} not found`);
  return row;
}

// Reserves the stipend before anyone drives. Serialized with an advisory lock so two trips
// can't both spend the last dollars in a pool.
export async function fundTrip(db: Db, tripId: string): Promise<{ funded: boolean }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`);
    const { trip, restaurantId, area } = await tripContext(tx as unknown as Db, tripId);
    if (trip.status !== "unfunded") return { funded: trip.status !== "cancelled" };

    const balances = await poolBalances(tx as unknown as Db);
    const { funded, allocations } = allocateTrip(trip.stipendCents, balances, { restaurantId, area });

    if (!funded) {
      const [open] = await tx
        .select({ id: alerts.id })
        .from(alerts)
        .where(and(eq(alerts.tripId, tripId), eq(alerts.kind, "unfunded_trip"), eq(alerts.resolved, false)));
      if (!open) {
        await tx.insert(alerts).values({
          kind: "unfunded_trip",
          tripId,
          message: `A ${formatUsd(trip.stipendCents)} pickup in ${area} has no funding yet.`,
        });
      }
      return { funded: false };
    }

    await tx.insert(reservations).values(allocations.map((a) => ({ ...a, tripId })));
    await tx.update(trips).set({ status: "funded" }).where(eq(trips.id, tripId));
    await tx
      .update(alerts)
      .set({ resolved: true })
      .where(and(eq(alerts.tripId, tripId), eq(alerts.kind, "unfunded_trip")));
    return { funded: true };
  });
}

// After new money arrives, retry trips that were waiting on funding, oldest first.
export async function fundWaitingTrips(db: Db): Promise<string[]> {
  const waiting = await db
    .select({ id: trips.id })
    .from(trips)
    .where(eq(trips.status, "unfunded"))
    .orderBy(asc(trips.createdAt));
  const funded: string[] = [];
  for (const { id } of waiting) {
    if ((await fundTrip(db, id)).funded) funded.push(id);
  }
  return funded;
}

// Sends the stipend once a delivery is verified. The status guard makes this safe to call twice.
export async function payTrip(db: Db, tripId: string): Promise<{ batchId: string } | null> {
  const [claimed] = await db
    .update(trips)
    .set({ status: "payout_pending" })
    .where(and(eq(trips.id, tripId), eq(trips.status, "verified")))
    .returning();
  if (!claimed?.driverId) return null;

  const [driver] = await db.select().from(drivers).where(eq(drivers.id, claimed.driverId));
  const receiver: PayoutReceiver =
    driver.payoutWallet === "venmo" && driver.venmoPhone
      ? { wallet: "venmo", phone: driver.venmoPhone }
      : { wallet: "paypal", email: driver.paypalEmail ?? "" };

  const held = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.tripId, tripId), eq(reservations.status, "held")));

  let batchId: string;
  try {
    ({ batchId } = await createPayout({
      tripId,
      amountCents: claimed.stipendCents,
      receiver,
      note: `Thanks for tonight's rescue. ${formatUsd(claimed.stipendCents)} fuel reimbursement.`,
    }));
  } catch (err) {
    await db.update(trips).set({ status: "verified" }).where(eq(trips.id, tripId));
    throw err;
  }

  await db.insert(ledgerEntries).values(
    held.map((r, i) => ({
      direction: "out" as const,
      amountCents: r.amountCents,
      poolId: r.poolId,
      source: "driver_payout" as const,
      status: "pending" as const,
      paypalRef: `${batchId}#${i}`,
      tripId,
      memo: `Fuel reimbursement for ${driver.name}`,
    })),
  );
  await db
    .update(reservations)
    .set({ status: "paid" })
    .where(inArray(reservations.id, held.map((r) => r.id)));
  await db.update(trips).set({ payoutBatchId: batchId }).where(eq(trips.id, tripId));

  // In mock mode nothing will call our webhook, so settle the payout straight away.
  if (paypalMode() === "mock") await settlePayout(db, tripId, "completed");
  return { batchId };
}

// Driven by PAYMENT.PAYOUTS-ITEM.* webhooks, so the ledger reflects PayPal's state.
export async function settlePayout(db: Db, tripId: string, outcome: "completed" | "failed") {
  await db
    .update(ledgerEntries)
    .set({ status: outcome })
    .where(and(eq(ledgerEntries.tripId, tripId), eq(ledgerEntries.source, "driver_payout")));

  if (outcome === "completed") {
    await db.update(trips).set({ status: "paid", paidAt: new Date() }).where(eq(trips.id, tripId));
    return;
  }
  // Put the money back on hold and hand the trip to a coordinator.
  await db
    .update(reservations)
    .set({ status: "held" })
    .where(and(eq(reservations.tripId, tripId), eq(reservations.status, "paid")));
  await db.update(trips).set({ status: "verified" }).where(eq(trips.id, tripId));
  await db.insert(alerts).values({
    kind: "verification_failed",
    tripId,
    message: "PayPal couldn't deliver a driver payout. Check the driver's PayPal or Venmo details.",
  });
}

// A cancelled trip gives its reserved money back to the pools.
export async function releaseTrip(db: Db, tripId: string) {
  await db
    .update(reservations)
    .set({ status: "released" })
    .where(and(eq(reservations.tripId, tripId), eq(reservations.status, "held")));
  await db.update(trips).set({ status: "cancelled" }).where(eq(trips.id, tripId));
}
