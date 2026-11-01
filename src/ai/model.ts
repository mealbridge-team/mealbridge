import { createGoogle } from "@ai-sdk/google";

// Gemini Flash on the free tier by default. Set GEMINI_MODEL to try another Gemini model.
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

export function aiMode(): "gemini" | "demo" {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "gemini" : "demo";
}

export function geminiModel() {
  const google = createGoogle({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
  return google(process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL);
}

// Daily cap on Gemini calls so a busy public demo can't exhaust the free-tier quota during
// judging. Past the cap, agents fall back to their rule-based behaviour (and say so).
// In memory: the app runs as a single instance, and the count resets on restart.
const DAILY_LIMIT = Number(process.env.GEMINI_DAILY_LIMIT ?? 400);
let budgetDay = "";
let callsToday = 0;

export function takeAiCall(): boolean {
  if (aiMode() === "demo") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    callsToday = 0;
  }
  if (callsToday >= DAILY_LIMIT) return false;
  callsToday++;
  return true;
}
