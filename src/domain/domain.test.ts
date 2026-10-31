import { describe, expect, it } from "vitest";
import { checkFoodSafety } from "./food-safety";
import { isOpenAt, meetsRequirement, rankShelters, type MatchShelter } from "./matcher";
import { stipendCents } from "./stipend";
import { allocateTrip, type PoolBalance } from "./treasurer";

const now = new Date("2026-11-05T05:00:00Z"); // 9:00pm in California
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const minutesFromNow = (m: number) => new Date(now.getTime() + m * 60_000);

describe("food safety", () => {
  const base = {
    holding: "hot" as const,
    cookedAt: minutesAgo(60),
    readyUntil: minutesFromNow(120),
    categories: ["cooked_meal" as const],
    aiConcerns: [],
    now,
  };

  it("approves hot food well inside the limit", () => {
    expect(checkFoodSafety(base).status).toBe("approved");
  });

  it("rejects unrefrigerated food held over 2 hours", () => {
    const r = checkFoodSafety({ ...base, holding: "ambient", cookedAt: minutesAgo(150) });
    expect(r.status).toBe("rejected");
    expect(r.reasons[0]).toMatch(/limit is 2h/);
  });

  it("cuts safe time to the holding limit, then rejects if too little is left", () => {
    // Cooked 3h20m ago and held hot: only 40 min left of the 4h limit.
    const r = checkFoodSafety({ ...base, cookedAt: minutesAgo(200) });
    expect(r.safeUntil.getTime()).toBe(minutesFromNow(40).getTime());
    expect(r.status).toBe("rejected");
  });

  it("never lets the model approve raw seafood", () => {
    const r = checkFoodSafety({ ...base, holding: "cold", categories: ["raw_seafood"] });
    expect(r.status).toBe("rejected");
  });

  it("sends model concerns to human review", () => {
    const r = checkFoodSafety({ ...base, aiConcerns: ["Container looks unsealed"] });
    expect(r.status).toBe("review");
  });
});

describe("matcher", () => {
  const listing = {
    lat: 37.8044,
    lng: -122.2711,
    totalPortions: 40,
    dietTags: ["vegetarian"],
    allergens: ["dairy"],
    safeUntil: minutesFromNow(120),
  };
  const shelter = (over: Partial<MatchShelter>): MatchShelter => ({
    id: "s",
    name: "Shelter",
    lat: 37.8115,
    lng: -122.2946,
    capacityPortions: 80,
    incomingPortions: 0,
    dietRequirements: [],
    opensAt: "17:00",
    closesAt: "23:00",
    ...over,
  });

  it("reads allergen-free and diet requirements", () => {
    expect(meetsRequirement(listing, "vegetarian")).toBe(true);
    expect(meetsRequirement(listing, "dairy_free")).toBe(false);
    expect(meetsRequirement(listing, "nut_free")).toBe(true);
    expect(meetsRequirement({ dietTags: ["vegan"], allergens: [] }, "vegetarian")).toBe(true);
  });

  it("handles overnight opening hours", () => {
    const late = new Date("2026-11-05T09:00:00Z"); // 1:00am in California
    expect(isOpenAt({ opensAt: "18:00", closesAt: "02:00" }, late)).toBe(true);
    expect(isOpenAt({ opensAt: "17:00", closesAt: "23:00" }, late)).toBe(false);
  });

  it("never sends food to a shelter whose requirements it breaks", () => {
    const { ranked, rejected } = rankShelters(
      listing,
      [shelter({ id: "ok" }), shelter({ id: "dairy", dietRequirements: ["dairy_free"] })],
      now,
    );
    expect(ranked.map((r) => r.shelterId)).toEqual(["ok"]);
    expect(rejected[0]).toMatchObject({ shelterId: "dairy" });
  });

  it("prefers the closer shelter and skips full ones", () => {
    const { ranked, rejected } = rankShelters(
      listing,
      [
        shelter({ id: "far", lat: 37.87, lng: -122.27 }),
        shelter({ id: "near", lat: 37.806, lng: -122.272 }),
        shelter({ id: "full", incomingPortions: 80 }),
      ],
      now,
    );
    expect(ranked[0].shelterId).toBe("near");
    expect(rejected.find((r) => r.shelterId === "full")?.reason).toMatch(/full/);
  });
});

describe("treasurer allocation", () => {
  const pools: PoolBalance[] = [
    { id: "general", kind: "general", area: null, restaurantId: null, availableCents: 10_000 },
    { id: "corp", kind: "sponsor", area: null, restaurantId: null, availableCents: 300 },
    { id: "city", kind: "sponsor", area: "oakland", restaurantId: null, availableCents: 500 },
    { id: "donors-oak", kind: "donor_area", area: "oakland", restaurantId: null, availableCents: 200 },
    { id: "donors-sf", kind: "donor_area", area: "san-francisco", restaurantId: null, availableCents: 9_000 },
    { id: "rest-a", kind: "restaurant", area: null, restaurantId: "a", availableCents: 100 },
  ];

  it("spends the restaurant's own plan, then local donors, then sponsors", () => {
    const r = allocateTrip(600, pools, { restaurantId: "a", area: "oakland" });
    expect(r).toEqual({
      funded: true,
      allocations: [
        { poolId: "rest-a", amountCents: 100 },
        { poolId: "donors-oak", amountCents: 200 },
        { poolId: "city", amountCents: 300 },
      ],
    });
  });

  it("ignores other areas' donors and other restaurants' plans", () => {
    const r = allocateTrip(400, pools, { restaurantId: "b", area: "berkeley" });
    expect(r.allocations).toEqual([
      { poolId: "corp", amountCents: 300 },
      { poolId: "general", amountCents: 100 },
    ]);
  });

  it("reserves nothing when the trip can't be fully funded", () => {
    const r = allocateTrip(500, [pools[1]], { restaurantId: "a", area: "oakland" });
    expect(r).toEqual({ funded: false, allocations: [] });
  });

  it("caps the stipend", () => {
    expect(stipendCents(5)).toBe(400);
    expect(stipendCents(500)).toBe(1500);
  });
});
