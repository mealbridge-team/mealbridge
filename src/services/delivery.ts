import { createHash } from "node:crypto";
import { and, eq, gte, ne } from "drizzle-orm";
import type { Db } from "@/db";
import { alerts, listings, matches, shelters, trips, type Verification } from "@/db/schema";
import { checkDropoffPhoto } from "@/agents/verifier";
import { haversineKm } from "@/lib/geo";
import { payTrip } from "./treasury";

export type Photo = { data: Uint8Array; mediaType: string };

// A drop-off must be this close to the shelter to count as the GPS signal.
export const DROPOFF_RADIUS_METERS = 300;
// And reported within this window around the planned drop-off.
const EARLY_MINUTES = 60;
const LATE_MINUTES = 120;

const toDataUrl = (p: Photo) => `data:${p.mediaType};base64,${Buffer.from(p.data).toString("base64")}`;
const hashOf = (dataUrl: string) => createHash("sha256").update(dataUrl).digest("hex");

async function tripWithContext(db: Db, tripId: string) {
  const [row] = await db
    .select({ trip: trips, shelter: shelters, listing: listings })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(shelters, eq(shelters.id, matches.shelterId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .where(eq(trips.id, tripId));
  return row ?? null;
}

export async function recordPickup(db: Db, tripId: string, driverId: string, photo: Photo, now = new Date()) {
  const [updated] = await db
    .update(trips)
    .set({ status: "picked_up", pickedUpAt: now, pickupPhotoUrl: toDataUrl(photo) })
    .where(and(eq(trips.id, tripId), eq(trips.driverId, driverId), eq(trips.status, "assigned")))
    .returning();
  return updated ?? null;
}

export async function recordDropoff(
  db: Db,
  tripId: string,
  driverId: string,
  input: { photo: Photo; lat: number; lng: number; simulatedLocation: boolean },
  now = new Date(),
) {
  const [updated] = await db
    .update(trips)
    .set({
      status: "delivered",
      deliveredAt: now,
      dropoffPhotoUrl: toDataUrl(input.photo),
      dropoffLat: input.lat,
      dropoffLng: input.lng,
      verification: { photo: false, gps: false, shelterConfirmed: false, notes: input.simulatedLocation ? ["Demo mode: simulated driver location."] : [] },
    })
    .where(and(eq(trips.id, tripId), eq(trips.driverId, driverId), eq(trips.status, "picked_up")))
    .returning();
  if (!updated) return null;
  return verifyTrip(db, tripId, input.photo, now);
}

// The shelter confirms the driver arrived. Rejecting the food still confirms arrival, so the
// driver is still paid; the listing just isn't counted as delivered.
export async function recordShelterConfirmation(db: Db, tripId: string, accepted: boolean, now = new Date()) {
  const [updated] = await db
    .update(trips)
    .set({ shelterConfirmedAt: now, shelterAccepted: accepted })
    .where(and(eq(trips.id, tripId), ne(trips.status, "cancelled")))
    .returning();
  if (!updated) return null;
  return updated.status === "delivered" ? verifyTrip(db, tripId, null, now) : updated;
}

// Verification agent: three independent signals before a dollar moves.
//   photo  - a drop-off photo exists, isn't a reused photo, and (if Gemini is on) looks like the listing
//   gps    - reported within 300 m of the shelter, near the planned time
//   shelter - the shelter tapped "received" (or rejected the food on arrival)
// All three: pay automatically. Fewer: hold for a coordinator.
export async function verifyTrip(db: Db, tripId: string, freshPhoto: Photo | null, now = new Date()) {
  const ctx = await tripWithContext(db, tripId);
  if (!ctx || ctx.trip.status !== "delivered") return ctx?.trip ?? null;
  const { trip, shelter, listing } = ctx;
  const earlier = trip.verification;
  const notes = [...(earlier?.notes ?? []).filter((n) => n.startsWith("Demo mode"))];

  // Photo signal. The AI check runs once, when the photo arrives; later passes (e.g. when the
  // shelter confirms) reuse that verdict instead of re-checking.
  let photo = Boolean(trip.dropoffPhotoUrl);
  if (trip.dropoffPhotoUrl && !freshPhoto && earlier) {
    photo = earlier.photo;
    notes.push(...earlier.notes.filter((n) => n.startsWith("Photo check") || n.startsWith("Drop-off photo was already")));
  } else if (trip.dropoffPhotoUrl) {
    const hash = hashOf(trip.dropoffPhotoUrl);
    const since = new Date(now.getTime() - 14 * 24 * 3_600_000);
    const others = await db
      .select({ url: trips.dropoffPhotoUrl, pickup: trips.pickupPhotoUrl, id: trips.id })
      .from(trips)
      .where(and(eq(trips.driverId, trip.driverId!), gte(trips.createdAt, since)));
    const reused = others.some(
      (o) => (o.id !== trip.id && o.url && hashOf(o.url) === hash) || (o.id === trip.id && o.pickup && hashOf(o.pickup) === hash),
    );
    if (reused) {
      photo = false;
      notes.push("Drop-off photo was already used on another delivery or at pickup.");
    } else if (freshPhoto) {
      const items = listing.items.map((i) => `${i.portions} portions ${i.name}`).join(", ");
      const check = await checkDropoffPhoto(freshPhoto, items);
      if (check && !(check.showsFood && check.consistentWithListing)) {
        photo = false;
        notes.push(`Photo check: ${check.notes}`);
      } else if (check) {
        notes.push(`Photo check passed: ${check.notes}`);
      }
    }
  } else {
    notes.push("No drop-off photo.");
  }

  // GPS + time signal.
  let gps = false;
  if (trip.dropoffLat != null && trip.dropoffLng != null && trip.deliveredAt) {
    const meters = haversineKm({ lat: trip.dropoffLat, lng: trip.dropoffLng }, shelter) * 1000;
    const minutesOff = (trip.deliveredAt.getTime() - trip.plannedDropoffAt.getTime()) / 60_000;
    const onTime = minutesOff >= -EARLY_MINUTES && minutesOff <= LATE_MINUTES;
    gps = meters <= DROPOFF_RADIUS_METERS && onTime;
    if (meters > DROPOFF_RADIUS_METERS) notes.push(`Drop-off reported ${Math.round(meters)} m from the shelter.`);
    if (!onTime) notes.push(`Drop-off was ${Math.round(Math.abs(minutesOff))} min off the planned time.`);
  }

  const shelterConfirmed = trip.shelterConfirmedAt != null;
  if (!shelterConfirmed) {
    // Not a failure yet: wait for the shelter before deciding.
    await db.update(trips).set({ verification: { photo, gps, shelterConfirmed, notes } }).where(eq(trips.id, tripId));
    return { ...trip, verification: { photo, gps, shelterConfirmed, notes } };
  }

  const verification: Verification = { photo, gps, shelterConfirmed, notes };
  const passed = photo && gps && shelterConfirmed;
  await db
    .update(trips)
    .set({ verification, status: passed ? "verified" : "needs_review" })
    .where(eq(trips.id, tripId));
  if (trip.shelterAccepted) await db.update(listings).set({ status: "delivered" }).where(eq(listings.id, listing.id));

  if (!passed) {
    await db.insert(alerts).values({
      kind: "verification_failed",
      tripId,
      message: `Delivery to ${shelter.name} needs a check before paying: ${notes.join(" ") || "a signal is missing."}`,
    });
    return { ...trip, status: "needs_review" as const, verification };
  }

  await payTripOrAlert(db, tripId);
  return { ...trip, status: "verified" as const, verification };
}

// A payout PayPal refuses shouldn't break the shelter's or coordinator's screen: the trip stays
// verified with its money still held, and the coordinator gets the reason and a retry button.
export async function payTripOrAlert(db: Db, tripId: string) {
  try {
    return await payTrip(db, tripId);
  } catch (err) {
    const details = (err as { details?: { message?: string; name?: string } }).details;
    await db.insert(alerts).values({
      kind: "payout_failed",
      tripId,
      message: `PayPal refused the driver payout: ${details?.message ?? (err as Error).message}${details?.name ? ` (${details.name})` : ""}`,
    });
    return null;
  }
}

// Coordinator looked at a held delivery and approved it.
export async function approveDelivery(db: Db, tripId: string) {
  const [updated] = await db
    .update(trips)
    .set({ status: "verified" })
    .where(and(eq(trips.id, tripId), eq(trips.status, "needs_review")))
    .returning();
  if (!updated) return null;
  await db
    .update(alerts)
    .set({ resolved: true })
    .where(and(eq(alerts.tripId, tripId), eq(alerts.kind, "verification_failed")));
  return payTripOrAlert(db, tripId);
}

// Coordinator retries a verified trip whose payout failed (e.g. after fixing driver details).
export async function retryPayout(db: Db, tripId: string) {
  await db
    .update(alerts)
    .set({ resolved: true })
    .where(and(eq(alerts.tripId, tripId), eq(alerts.kind, "payout_failed")));
  return payTripOrAlert(db, tripId);
}
