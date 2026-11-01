import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { donationOrders, donors, fundingPools } from "@/db/schema";
import { captureOrder, createOrder } from "@/paypal/api";
import { dispatchTrip } from "./pipeline";
import { fundTrip, fundWaitingTrips, recordIncoming } from "./treasury";
import { encodeCustomId } from "@/paypal/custom-id";

export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 50_000;

export class DonationError extends Error {}

export async function startDonation(
  db: Db,
  input: { poolId: string; amountCents: number; donorName: string; donorEmail: string; anonymous: boolean; tripId?: string },
) {
  if (!Number.isInteger(input.amountCents) || input.amountCents < MIN_DONATION_CENTS || input.amountCents > MAX_DONATION_CENTS) {
    throw new DonationError("Choose an amount between $1 and $500.");
  }
  const [pool] = await db.select().from(fundingPools).where(eq(fundingPools.id, input.poolId));
  if (!pool || (pool.kind !== "donor_area" && pool.kind !== "general")) throw new DonationError("Unknown fund.");

  const email = input.donorEmail.trim().toLowerCase();
  let [donor] = await db.select().from(donors).where(eq(donors.email, email));
  if (!donor) {
    [donor] = await db
      .insert(donors)
      .values({ name: input.donorName.trim() || "Anonymous donor", email, anonymous: input.anonymous })
      .returning();
  }

  const { orderId } = await createOrder({
    amountCents: input.amountCents,
    customId: encodeCustomId({ poolId: pool.id, donorId: donor.id }),
    description: `MealBridge rescue fund: ${pool.label}`,
  });
  await db.insert(donationOrders).values({
    orderId,
    poolId: pool.id,
    donorId: donor.id,
    amountCents: input.amountCents,
    tripId: input.tripId,
  });
  return { orderId };
}

// Shared by the checkout capture and the PAYMENT.CAPTURE.COMPLETED webhook; whichever arrives
// second finds the ledger entry already there and does nothing.
export async function receiveDonation(
  db: Db,
  input: { poolId: string; donorId?: string; amountCents: number; captureId: string; tripId?: string | null },
) {
  const isNew = await recordIncoming(db, {
    poolId: input.poolId,
    donorId: input.donorId,
    amountCents: input.amountCents,
    source: "donation",
    paypalRef: input.captureId,
  });
  if (!isNew) return { funded: [] as string[] };

  const funded: string[] = [];
  if (input.tripId && (await fundTrip(db, input.tripId)).funded) funded.push(input.tripId);
  funded.push(...(await fundWaitingTrips(db)));
  for (const tripId of funded) await dispatchTrip(db, tripId);
  return { funded };
}

export async function completeDonation(db: Db, orderId: string) {
  const [order] = await db
    .select()
    .from(donationOrders)
    .where(and(eq(donationOrders.orderId, orderId), eq(donationOrders.status, "created")));
  if (!order) throw new DonationError("This checkout has already been completed or doesn't exist.");

  const capture = await captureOrder(orderId, {
    amountCents: order.amountCents,
    customId: encodeCustomId({ poolId: order.poolId, donorId: order.donorId }),
  });
  if (capture.amountCents !== order.amountCents) {
    await db.update(donationOrders).set({ status: "failed" }).where(eq(donationOrders.orderId, orderId));
    throw new DonationError("PayPal captured a different amount than was ordered.");
  }

  await db
    .update(donationOrders)
    .set({ status: "captured", captureId: capture.captureId })
    .where(eq(donationOrders.orderId, orderId));
  const { funded } = await receiveDonation(db, {
    poolId: order.poolId,
    donorId: order.donorId,
    amountCents: order.amountCents,
    captureId: capture.captureId,
    tripId: order.tripId,
  });
  return { captureId: capture.captureId, amountCents: order.amountCents, fundedTrips: funded };
}
