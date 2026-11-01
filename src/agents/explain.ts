import { generateText } from "ai";
import { geminiModel, takeAiCall } from "@/ai/model";

// Short, human explanations of decisions the code already made. The model never changes
// the decision; if it fails or is unavailable we keep the template sentence.
export async function explain(task: string, facts: Record<string, unknown>, fallback: string): Promise<string> {
  if (!(await takeAiCall("fast"))) return fallback;
  try {
    const { text } = await generateText({
      model: geminiModel("fast"),
      system:
        "You write one plain sentence (max 25 words) for a food-rescue coordinator app. Use only the facts given. No greetings, no emojis.",
      prompt: `${task}\nFacts: ${JSON.stringify(facts)}`,
      // A one-liner needs no deliberation; minimal thinking keeps it fast and stops thinking
      // tokens from crowding out the sentence.
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
      maxOutputTokens: 400,
    });
    const sentence = text.trim().split("\n")[0];
    // Reject anything that isn't a complete sentence (e.g. cut off mid-way).
    return sentence.length >= 20 && sentence.length < 240 && /[.!]$/.test(sentence) ? sentence : fallback;
  } catch (err) {
    console.warn("explain() fell back to template", err);
    return fallback;
  }
}
