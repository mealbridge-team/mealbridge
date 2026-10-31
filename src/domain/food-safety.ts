// Hard food-safety rules. These run in code, after the Intake agent; the model can raise
// concerns that send a listing to human review, but it can never approve a listing these reject.
//
// Limits follow the time-as-a-control idea in the FDA Food Code / California Retail Food Code
// (4 hours out of temperature control), made stricter for unrefrigerated food. Assumptions are
// listed in the README; this is a hackathon prototype, not legal guidance.

export type Holding = "hot" | "cold" | "ambient";

export const FOOD_CATEGORIES = [
  "cooked_meal",
  "baked_goods",
  "produce",
  "dairy",
  "dessert",
  "packaged",
  "beverage",
  "raw_meat",
  "raw_seafood",
  "other",
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const MAX_HOURS_SINCE_COOKED: Record<Holding, number> = {
  ambient: 2,
  hot: 4,
  cold: 24,
};

// Not accepted at all: raw animal protein is too risky to move through volunteers' cars.
const REJECTED_CATEGORIES: FoodCategory[] = ["raw_meat", "raw_seafood"];

// Minimum time left to pick up, drive and hand over.
export const MIN_DELIVERY_WINDOW_MINUTES = 45;

export type SafetyInput = {
  holding: Holding;
  cookedAt: Date;
  readyUntil: Date;
  categories: FoodCategory[];
  aiConcerns: string[];
  now: Date;
};

export type SafetyResult = {
  status: "approved" | "review" | "rejected";
  reasons: string[];
  // readyUntil, cut short if the holding limit runs out first.
  safeUntil: Date;
};

export function checkFoodSafety(input: SafetyInput): SafetyResult {
  const reasons: string[] = [];
  const limitMs = MAX_HOURS_SINCE_COOKED[input.holding] * 3_600_000;
  const holdingDeadline = new Date(input.cookedAt.getTime() + limitMs);
  const safeUntil = new Date(Math.min(input.readyUntil.getTime(), holdingDeadline.getTime()));

  if (input.cookedAt.getTime() > input.now.getTime() + 5 * 60_000) {
    reasons.push("Cooking time is in the future.");
  }

  const banned = input.categories.filter((c) => REJECTED_CATEGORIES.includes(c));
  if (banned.length > 0) {
    reasons.push(`Raw meat or seafood can't be rescued (${banned.join(", ")}).`);
  }

  const hoursHeld = (input.now.getTime() - input.cookedAt.getTime()) / 3_600_000;
  if (hoursHeld > MAX_HOURS_SINCE_COOKED[input.holding]) {
    reasons.push(
      `Held ${input.holding} for ${hoursHeld.toFixed(1)}h; the limit is ${MAX_HOURS_SINCE_COOKED[input.holding]}h.`,
    );
  } else {
    const minutesLeft = (safeUntil.getTime() - input.now.getTime()) / 60_000;
    if (minutesLeft < MIN_DELIVERY_WINDOW_MINUTES) {
      reasons.push(
        `Only ${Math.max(0, Math.floor(minutesLeft))} min of safe time left; a delivery needs ${MIN_DELIVERY_WINDOW_MINUTES}.`,
      );
    }
  }

  if (reasons.length > 0) return { status: "rejected", reasons, safeUntil };
  if (input.aiConcerns.length > 0) return { status: "review", reasons: input.aiConcerns, safeUntil };
  return { status: "approved", reasons: [], safeUntil };
}
