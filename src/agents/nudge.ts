import { generateText } from "ai";
import { geminiModel, takeAiCall } from "@/ai/model";

export type NudgeFacts = {
  sponsorName: string;
  invoiceNumber: string;
  amountUsd: string;
  daysOutstanding: number;
  tripsFundedSoFar: number;
  mealsFundedSoFar: number;
  waitingTrips: number;
};

// Nudge agent: drafts the note on a PayPal invoice reminder. Warm and specific, never a demand.
// The coordinator sees the draft before it's sent; without Gemini a template is used.
export async function draftNudge(facts: NudgeFacts): Promise<{ text: string; mode: "gemini" | "template" }> {
  const template =
    `Hi ${facts.sponsorName} team, a gentle heads-up that invoice ${facts.invoiceNumber} (${facts.amountUsd}) is still open. ` +
    `Your support has already covered ${facts.tripsFundedSoFar} rescue trips and about ${facts.mealsFundedSoFar} meals` +
    (facts.waitingTrips > 0 ? `, and ${facts.waitingTrips} pickups are waiting for funding tonight.` : ".") +
    " Thank you for keeping food out of the bin!";
  if (!(await takeAiCall("fast"))) return { text: template, mode: "template" };

  try {
    const { text } = await generateText({
      model: geminiModel("fast"),
      system:
        "You write short, friendly payment reminders for a food-rescue nonprofit. Two or three sentences, under 70 words. " +
        "Warm and grateful, never pushy or guilt-tripping. Mention the concrete impact from the facts. Use only the facts given. No emojis, no sign-off.",
      prompt: JSON.stringify(facts),
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
      maxOutputTokens: 500,
    });
    const note = text.trim();
    return note.length >= 40 && note.length <= 600 && /[.!]$/.test(note) ? { text: note, mode: "gemini" } : { text: template, mode: "template" };
  } catch (err) {
    console.warn("draftNudge fell back to template", err);
    return { text: template, mode: "template" };
  }
}
