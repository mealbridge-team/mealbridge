import { generateText, Output } from "ai";
import { z } from "zod";
import { aiMode, geminiModel, takeAiCall } from "@/ai/model";
import { FOOD_CATEGORIES } from "@/domain/food-safety";

export const ALLERGENS = [
  "peanuts",
  "tree_nuts",
  "dairy",
  "eggs",
  "gluten",
  "soy",
  "fish",
  "shellfish",
  "sesame",
] as const;
export const DIET_TAGS = ["vegetarian", "vegan", "halal", "kosher"] as const;

export const intakeSchema = z.object({
  summary: z.string().describe('One short line for the listing card, e.g. "~40 portions of veg biryani"'),
  items: z
    .array(
      z.object({
        name: z.string(),
        portions: z.number().int().min(1),
        category: z.enum(FOOD_CATEGORIES),
      }),
    )
    .min(1),
  allergens: z.array(z.enum(ALLERGENS)),
  dietTags: z.array(z.enum(DIET_TAGS)),
  holding: z.enum(["hot", "cold", "ambient"]),
  minutesSinceCooked: z.number().int().min(0),
  readyForMinutes: z.number().int().min(0).describe("How long the restaurant can hold the food for pickup"),
  concerns: z.array(z.string()).describe("Visible food-safety problems only; empty if none"),
});

export type IntakeReading = z.infer<typeof intakeSchema>;

export type IntakeInput = {
  photo?: { data: Uint8Array; mediaType: string };
  notes: string;
};

const SYSTEM = `You read surplus-food listings for MealBridge, which moves restaurant surplus to shelters in California.
From a photo and/or the restaurant's note (any language), estimate what the food is and how many portions it makes.
- Be conservative with portions: one portion is one adult meal.
- List an allergen if it is likely present and you are not sure it is absent. Missing an allergen can hurt someone.
- Only add a diet tag if the food clearly qualifies.
- If the note gives cooking time or holding (hot, fridge, room temperature), use it. Otherwise assume ambient and 60 minutes.
- Put anything that looks unsafe (spoilage, unsealed or damaged containers, raw meat or seafood) in concerns.
- You do not approve food. Safety rules run after you.`;

export async function readSurplus(input: IntakeInput): Promise<{ reading: IntakeReading; mode: "gemini" | "demo" }> {
  // Rules can read a typed note, but can't guess what's in a photo. Without the AI, a photo-only
  // listing has to ask for a note instead of inventing one.
  const fallback = () => {
    if (!input.notes.trim()) throw new IntakeUnavailableError();
    return { reading: demoReading(input.notes), mode: "demo" as const };
  };
  if (aiMode() === "demo" || !takeAiCall()) return fallback();

  const content: ({ type: "text"; text: string } | { type: "file"; mediaType: string; data: Uint8Array })[] = [
    { type: "text", text: `Restaurant note: ${input.notes || "(none)"}` },
  ];
  if (input.photo) content.push({ type: "file", mediaType: input.photo.mediaType, data: input.photo.data });

  try {
    const { output } = await generateText({
      model: geminiModel(),
      system: SYSTEM,
      output: Output.object({ schema: intakeSchema }),
      messages: [{ role: "user", content }],
    });
    return { reading: output, mode: "gemini" };
  } catch (err) {
    // Quota exhausted or Gemini down: keep the rescue moving on the note alone.
    console.warn("Intake fell back to rules", err);
    return fallback();
  }
}

export class IntakeUnavailableError extends Error {
  constructor() {
    super("The AI can't read photos right now. Add a short note, e.g. \"30 portions pasta, kept hot\".");
  }
}

// Without a Gemini key, read the note with simple rules so the flow still works end to end.
// The UI labels these listings as demo readings.
export function demoReading(notes: string): IntakeReading {
  const text = notes.toLowerCase();
  const portions = Number(text.match(/(\d+)\s*(portions?|servings?|meals?|plates?|trays?)?/)?.[1] ?? 20);
  const veg = /\b(veg|vegetarian|paneer|dal|tofu)\b/.test(text);
  const vegan = /\bvegan\b/.test(text);
  const holding = /\b(fridge|chilled|cold)\b/.test(text) ? "cold" : /\b(hot|warm|chafing)\b/.test(text) ? "hot" : "ambient";
  const allergens = ALLERGENS.filter((a) => text.includes(a.replace("_", " ")) || (a === "dairy" && /\b(paneer|cheese|cream|milk)\b/.test(text)));
  const name = notes.replace(/\d+\s*(portions?|servings?|meals?|plates?|trays?)?/i, "").trim() || "Mixed cooked meals";

  return {
    summary: `~${portions} portions of ${name}`,
    items: [{ name, portions, category: "cooked_meal" }],
    allergens,
    dietTags: vegan ? ["vegan", "vegetarian"] : veg ? ["vegetarian"] : [],
    holding,
    minutesSinceCooked: 60,
    readyForMinutes: 120,
    concerns: [],
  };
}
