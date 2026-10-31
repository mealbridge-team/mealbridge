import { driveMinutes, roadKm, type LatLng } from "@/lib/geo";

export const SHELTER_TIME_ZONE = "America/Los_Angeles";

export type MatchListing = LatLng & {
  totalPortions: number;
  dietTags: string[];
  allergens: string[];
  safeUntil: Date;
};

export type MatchShelter = LatLng & {
  id: string;
  name: string;
  capacityPortions: number;
  // Portions already on their way tonight.
  incomingPortions: number;
  dietRequirements: string[];
  opensAt: string;
  closesAt: string;
};

export type RankedShelter = {
  shelterId: string;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  usablePortions: number;
  reason: string;
};

export type Rejection = { shelterId: string; reason: string };

// A requirement is either a diet tag the food must carry, or "<allergen>_free".
export function meetsRequirement(listing: Pick<MatchListing, "dietTags" | "allergens">, requirement: string) {
  if (requirement.endsWith("_free")) {
    const allergen = requirement.slice(0, -"_free".length);
    return !listing.allergens.includes(allergen);
  }
  if (requirement === "vegetarian") {
    return listing.dietTags.includes("vegetarian") || listing.dietTags.includes("vegan");
  }
  return listing.dietTags.includes(requirement);
}

function minutesOfDay(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function localMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHELTER_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

// Handles overnight windows such as 18:00-02:00.
export function isOpenAt(shelter: Pick<MatchShelter, "opensAt" | "closesAt">, at: Date) {
  const open = minutesOfDay(shelter.opensAt);
  const close = minutesOfDay(shelter.closesAt);
  const now = localMinutes(at);
  return open <= close ? now >= open && now < close : now >= open || now < close;
}

const WEIGHTS = { distance: 40, fit: 35, need: 25 };
const MAX_USEFUL_KM = 15;

export function rankShelters(
  listing: MatchListing,
  shelters: MatchShelter[],
  now: Date,
): { ranked: RankedShelter[]; rejected: Rejection[] } {
  const ranked: RankedShelter[] = [];
  const rejected: Rejection[] = [];

  for (const shelter of shelters) {
    const broken = shelter.dietRequirements.filter((r) => !meetsRequirement(listing, r));
    if (broken.length > 0) {
      rejected.push({ shelterId: shelter.id, reason: `Doesn't meet ${broken.join(", ")}` });
      continue;
    }

    const remaining = shelter.capacityPortions - shelter.incomingPortions;
    if (remaining <= 0) {
      rejected.push({ shelterId: shelter.id, reason: "Already full tonight" });
      continue;
    }

    const distanceKm = roadKm(listing, shelter);
    const etaMinutes = driveMinutes(distanceKm);
    const arrival = new Date(now.getTime() + etaMinutes * 60_000);
    if (arrival > listing.safeUntil) {
      rejected.push({ shelterId: shelter.id, reason: "Too far to arrive while the food is safe" });
      continue;
    }
    if (!isOpenAt(shelter, arrival)) {
      rejected.push({ shelterId: shelter.id, reason: "Closed at arrival time" });
      continue;
    }

    const usablePortions = Math.min(listing.totalPortions, remaining);
    const distanceScore = Math.max(0, 1 - distanceKm / MAX_USEFUL_KM);
    const fitScore = usablePortions / listing.totalPortions;
    const needScore = remaining / shelter.capacityPortions;
    const score =
      Math.round(
        (distanceScore * WEIGHTS.distance + fitScore * WEIGHTS.fit + needScore * WEIGHTS.need) * 10,
      ) / 10;

    ranked.push({
      shelterId: shelter.id,
      score,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes,
      usablePortions,
      reason: `${shelter.name} is ${etaMinutes} min away and can still use ${usablePortions} of ${listing.totalPortions} portions tonight.`,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return { ranked, rejected };
}
