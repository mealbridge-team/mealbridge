"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { IntakeUnavailableError } from "@/agents/intake";
import { allow } from "@/lib/rate-limit";
import { getDb } from "@/db";
import { resetDemoData } from "@/db/seed";
import {
  approveDelivery,
  recordDropoff,
  recordPickup,
  recordShelterConfirmation,
  retryPayout,
  type Photo,
} from "@/services/delivery";
import { createListing } from "@/services/listings";
import { cancelTrip, matchListing, reassignTrip, type MatchOutcome } from "@/services/pipeline";
import { refreshPendingPayouts } from "@/services/treasury";
import { requireCoordinator, unlockCoordinator } from "@/lib/access";

// Prototype note: there is no sign-in yet. Each screen picks who you are from a list, so these
// actions trust the ids they're given. Real accounts are out of scope for the hackathon.

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

async function readPhoto(value: FormDataEntryValue | null): Promise<Photo | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (!value.type.startsWith("image/") || value.size > MAX_PHOTO_BYTES) return null;
  return { data: new Uint8Array(await value.arrayBuffer()), mediaType: value.type };
}

export type PostSurplusResult =
  | { ok: true; summary: string; mode: "gemini" | "demo"; safety: { status: string; reasons: string[] }; match: MatchOutcome | null }
  | { ok: false; error: string };

export async function postSurplus(_prev: PostSurplusResult | null, form: FormData): Promise<PostSurplusResult> {
  const restaurantId = String(form.get("restaurantId") ?? "");
  const notes = String(form.get("notes") ?? "").slice(0, 1000);
  const photo = await readPhoto(form.get("photo"));
  if (!photo && !notes.trim()) return { ok: false, error: "Add a photo or a short note about the food." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(`post-surplus:${ip}`, 8, 10 * 60_000)) {
    return { ok: false, error: "That's a lot of posts in a few minutes. Please wait a little and try again." };
  }

  const db = getDb();
  try {
    const { listing, reading, mode, safety } = await createListing(db, {
      restaurantId,
      notes,
      photo: photo ?? undefined,
      photoUrl: photo ? `data:${photo.mediaType};base64,${Buffer.from(photo.data).toString("base64")}` : undefined,
    });
    const match = safety.status === "approved" ? await matchListing(db, listing.id) : null;
    refresh();
    return { ok: true, summary: reading.summary, mode, safety: { status: safety.status, reasons: safety.reasons }, match };
  } catch (err) {
    if (err instanceof IntakeUnavailableError) return { ok: false, error: err.message };
    console.error("postSurplus failed", err);
    return { ok: false, error: "We couldn't read that listing. Try again, or type a short note instead." };
  }
}

export async function driverPickup(form: FormData) {
  const photo = await readPhoto(form.get("photo"));
  if (!photo) throw new Error("A pickup photo is required.");
  await recordPickup(getDb(), String(form.get("tripId")), String(form.get("driverId")), photo);
  refresh();
}

export async function driverDropoff(form: FormData) {
  const photo = await readPhoto(form.get("photo"));
  if (!photo) throw new Error("A drop-off photo is required.");
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Location is required.");
  await recordDropoff(getDb(), String(form.get("tripId")), String(form.get("driverId")), {
    photo,
    lat,
    lng,
    simulatedLocation: form.get("simulated") === "true",
  });
  refresh();
}

export async function shelterConfirm(tripId: string, accepted: boolean) {
  await recordShelterConfirmation(getDb(), tripId, accepted);
  refresh();
}

export async function unlockCoordinatorAction(_prev: string | null, form: FormData): Promise<string | null> {
  if (!(await unlockCoordinator(String(form.get("passcode") ?? "")))) return "That passcode isn't right.";
  refresh();
  return null;
}

export async function coordinatorApprove(tripId: string) {
  await requireCoordinator();
  await approveDelivery(getDb(), tripId);
  refresh();
}

export async function coordinatorRetryPayout(tripId: string) {
  await requireCoordinator();
  await retryPayout(getDb(), tripId);
  refresh();
}

export async function coordinatorReassign(tripId: string) {
  await requireCoordinator();
  await reassignTrip(getDb(), tripId);
  refresh();
}

export async function coordinatorCancel(tripId: string) {
  await requireCoordinator();
  await cancelTrip(getDb(), tripId);
  refresh();
}

export async function checkPayouts() {
  // Only reads PayPal's state and settles the ledger, so it's safe for anyone to trigger.
  await refreshPendingPayouts(getDb());
  refresh();
}

export async function resetDemo() {
  await requireCoordinator();
  await resetDemoData(getDb());
  refresh();
}
