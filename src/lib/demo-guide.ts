import { cookies } from "next/headers";
import { and, desc, eq, gte } from "drizzle-orm";
import type { Db } from "@/db";
import { drivers, listings, matches, restaurants, shelters, trips } from "@/db/schema";
import { formatUsd } from "@/domain/stipend";
import type { Role } from "@/lib/demo-session";

// The guided rescue: one restaurant posts, its driver delivers, the shelter confirms, PayPal pays.
// We only remember which restaurant the guide started with and when; every step after that is read
// from the rescue's own status, so the guide can never drift from what really happened.

const COOKIE = "mb_guide";

type GuideCookie = { restaurantId: string; since: number };

export async function readGuide(): Promise<GuideCookie | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [restaurantId, since] = raw.split(":");
  return restaurantId && Number(since) ? { restaurantId, since: Number(since) } : null;
}

export async function startGuide(restaurantId: string, now = Date.now()) {
  (await cookies()).set(COOKIE, `${restaurantId}:${now}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12, path: "/" });
}

export async function endGuide() {
  (await cookies()).delete(COOKIE);
}

/** 1 post, 2 deliver, 3 confirm, 4 paid (finished). */
export type GuideStep = 1 | 2 | 3 | 4;
export type Who = { role: Role; id: string; name: string };

export type GuideState = {
  step: GuideStep;
  /** Who does the current step (once finished, the driver, to see the payout). */
  who: Who;
  title: string;
  todo: string;
  /** Set when the rescue can't go on as a guided one (rejected food, held delivery). */
  problem?: string;
  /** The rescue is stuck; offer to start the guide over. */
  restart?: boolean;
  stipendCents?: number;
};

// "Lakeside Catering Co." already ends a sentence; don't add a second full stop.
const end = (name: string) => (name.endsWith(".") ? name : `${name}.`);

export async function guideState(db: Db, guide: GuideCookie): Promise<GuideState | null> {
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, guide.restaurantId)).limit(1);
  if (!restaurant) return null;
  const atRestaurant: Who = { role: "restaurant", id: restaurant.id, name: restaurant.name };

  const [latest] = await db
    .select({ listing: listings, trip: trips, shelter: shelters, driver: drivers })
    .from(listings)
    .leftJoin(matches, eq(matches.listingId, listings.id))
    .leftJoin(trips, eq(trips.matchId, matches.id))
    .leftJoin(shelters, eq(shelters.id, matches.shelterId))
    .leftJoin(drivers, eq(drivers.id, trips.driverId))
    .where(and(eq(listings.restaurantId, restaurant.id), gte(listings.createdAt, new Date(guide.since))))
    .orderBy(desc(listings.createdAt))
    .limit(1);

  const postStep: GuideState = {
    step: 1,
    who: atRestaurant,
    title: `You're ${end(restaurant.name)} Post tonight's surplus.`,
    todo: "Tap an example note (or type one), then press Post surplus. Gemini reads it, a shelter is matched and a driver is booked.",
  };
  if (!latest) return postStep;

  const { listing, trip, shelter, driver } = latest;
  if (listing.safetyStatus === "rejected")
    return { ...postStep, problem: "The food-safety rules turned that one away, which is the system working. Post something else to carry on." };
  if (listing.safetyStatus === "review") return { ...postStep, problem: "That listing went to a coordinator for a food-safety check. Post another to carry on." };
  if (!trip || !shelter) return { ...postStep, problem: "No shelter could take that one right now. Try a different note to carry on." };
  if (trip.status === "cancelled") return { ...postStep, problem: "That rescue was cancelled. Post again to start a new one." };
  if (!driver)
    return {
      ...postStep,
      problem:
        trip.status === "unfunded"
          ? "The trip is waiting for money (a donor can fund it on the Donate page). Post from a restaurant on the compliance plan to carry on."
          : "No driver was free. Post again in a moment.",
    };

  const atDriver: Who = { role: "driver", id: driver.id, name: driver.name };
  const atShelter: Who = { role: "shelter", id: shelter.id, name: shelter.name };

  if (trip.status === "assigned" || trip.status === "funded" || trip.status === "picked_up")
    return {
      step: 2,
      who: atDriver,
      stipendCents: trip.stipendCents,
      title: `You're ${driver.name}, the volunteer driver.`,
      todo:
        trip.status === "picked_up"
          ? "Food's on board. Press Demo: I'm at the shelter, add a new photo of the same food (not the pickup one), then press Delivered."
          : "Press Demo: simulate the drive, add a photo of the food, then press I've picked it up.",
    };
  if (trip.status === "needs_review") {
    const reason = trip.verification?.notes.find((n) => !n.startsWith("Demo mode") && !n.startsWith("Photo check passed"));
    return {
      step: 3,
      who: atShelter,
      title: "A safeguard held this delivery for a coordinator.",
      todo: "",
      problem: `${reason ? `${reason} ` : ""}Payment waits for a person to check, which is the system working. Start a new rescue to see the happy path.`,
      restart: true,
    };
  }
  if (trip.status === "delivered")
    return {
      step: 3,
      who: atShelter,
      stipendCents: trip.stipendCents,
      title: `You're ${end(shelter.name)}`,
      todo: "The food is here. Press Received: photo, GPS and your tap agree, so PayPal reimburses the driver.",
    };
  // A sent payout counts as done: PayPal's sandbox can take a minute or two to report it paid.
  const paid = trip.status === "paid";
  return {
    step: 4,
    who: atDriver,
    stipendCents: trip.stipendCents,
    title: paid
      ? `Rescue complete. ${driver.name} was reimbursed ${formatUsd(trip.stipendCents)} through PayPal.`
      : `Rescue complete. PayPal Payouts is sending ${driver.name} ${formatUsd(trip.stipendCents)}.`,
    todo: `${listing.totalPortions} portions went from ${restaurant.name} to ${shelter.publicLabel}. Every step is on the Impact page.`,
  };
}
