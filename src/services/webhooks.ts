import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { paypalEvents } from "@/db/schema";
import { paypalValueToCents } from "@/domain/stipend";
import { fundWaitingTrips, recordIncoming, settlePayout } from "./treasury";

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

// custom_id on every order: "pool:<poolId>;donor:<donorId>" (donor optional).
export function encodeCustomId(tag: { poolId: string; donorId?: string }) {
  return tag.donorId ? `pool:${tag.poolId};donor:${tag.donorId}` : `pool:${tag.poolId}`;
}

export function decodeCustomId(customId: string): { poolId?: string; donorId?: string } {
  const out: { poolId?: string; donorId?: string } = {};
  for (const part of customId.split(";")) {
    const [key, value] = part.split(":");
    if (key === "pool") out.poolId = value;
    if (key === "donor") out.donorId = value;
  }
  return out;
}

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

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const tag = decodeCustomId(r.custom_id ?? "");
    if (tag.poolId && r.id && r.amount) {
      const isNew = await recordIncoming(db, {
        poolId: tag.poolId,
        donorId: tag.donorId,
        amountCents: paypalValueToCents(r.amount.value),
        source: "donation",
        paypalRef: r.id,
      });
      if (isNew) await fundWaitingTrips(db);
    }
  } else if (event.event_type === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED") {
    const tripId = r.payout_item?.sender_item_id;
    if (tripId) await settlePayout(db, tripId, "completed");
  } else if (PAYOUT_FAILED.has(event.event_type)) {
    const tripId = r.payout_item?.sender_item_id;
    if (tripId) await settlePayout(db, tripId, "failed");
  } else {
    handled = false;
  }

  await db.update(paypalEvents).set({ processedAt: new Date() }).where(eq(paypalEvents.id, event.id));
  return handled ? "processed" : "ignored";
}
