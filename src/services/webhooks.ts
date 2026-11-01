import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { paypalEvents } from "@/db/schema";
import { paypalValueToCents } from "@/domain/stipend";
import { decodeCustomId } from "@/paypal/custom-id";
import { receiveDonation } from "./donations";
import { flagUnclaimedPayout, settlePayout } from "./treasury";

export { decodeCustomId, encodeCustomId } from "@/paypal/custom-id";

export type PayPalEvent = {
  id: string;
  event_type: string;
  resource: Record<string, unknown> & {
    id?: string;
    custom_id?: string;
    amount?: { value: string };
    payout_item?: { sender_item_id?: string };
  };
};

const PAYOUT_FAILED = new Set([
  "PAYMENT.PAYOUTS-ITEM.FAILED",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED",
  "PAYMENT.PAYOUTS-ITEM.DENIED",
]);

export async function processPayPalEvent(db: Db, event: PayPalEvent): Promise<"processed" | "duplicate" | "ignored"> {
  const inserted = await db
    .insert(paypalEvents)
    .values({ id: event.id, eventType: event.event_type, payload: event })
    .onConflictDoNothing()
    .returning({ id: paypalEvents.id });
  if (inserted.length === 0) return "duplicate";

  let handled = true;
  const r = event.resource;
  const payoutTripId = r.payout_item?.sender_item_id;

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const tag = decodeCustomId(r.custom_id ?? "");
    if (tag.poolId && r.id && r.amount) {
      await receiveDonation(db, {
        poolId: tag.poolId,
        donorId: tag.donorId,
        amountCents: paypalValueToCents(r.amount.value),
        captureId: r.id,
      });
    }
  } else if (event.event_type === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED") {
    if (payoutTripId) await settlePayout(db, payoutTripId, "completed");
  } else if (PAYOUT_FAILED.has(event.event_type)) {
    if (payoutTripId) await settlePayout(db, payoutTripId, "failed");
  } else if (event.event_type === "PAYMENT.PAYOUTS-ITEM.UNCLAIMED") {
    if (payoutTripId) await flagUnclaimedPayout(db, payoutTripId);
  } else {
    handled = false;
  }

  await db.update(paypalEvents).set({ processedAt: new Date() }).where(eq(paypalEvents.id, event.id));
  return handled ? "processed" : "ignored";
}
