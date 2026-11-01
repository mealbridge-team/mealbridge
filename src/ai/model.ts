import { createGoogle } from "@ai-sdk/google";

// Gemini on the free tier. "main" reads photos and notes; "fast" writes the one-line explanations
// and runs the dashboard agents. Both default to Flash-Lite: on the free tier Flash allows only 20
// requests a day, which a public demo uses up in a few rescues. Set GEMINI_MODEL=gemini-3.5-flash
// on a paid key for sharper photo reading.
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GEMINI_FAST_MODEL = "gemini-3.5-flash-lite";

export type ModelKind = "main" | "fast";

export function aiMode(): "gemini" | "demo" {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "gemini" : "demo";
}

function modelId(kind: ModelKind) {
  return kind === "main"
    ? (process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL)
    : (process.env.GEMINI_FAST_MODEL ?? DEFAULT_GEMINI_FAST_MODEL);
}

export function geminiModel(kind: ModelKind = "main") {
  const google = createGoogle({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
  return google(modelId(kind));
}

// Requests per minute we allow ourselves per model, a little under the free tier's limits. Free-tier
// limits are per model, so when both kinds use the same model they share one window.
function rpm(model: string) {
  return model === modelId("fast") ? Number(process.env.GEMINI_FAST_RPM ?? 14) : Number(process.env.GEMINI_RPM ?? 5);
}
const recent = new Map<string, number[]>();

// Daily cap on Gemini calls so a busy public demo can't exhaust the free-tier quota during
// judging. Past the cap, agents fall back to their rule-based behaviour (and say so).
// In memory: the app runs as a single instance, and the count resets on restart.
const DAILY_LIMIT = Number(process.env.GEMINI_DAILY_LIMIT ?? 400);
let budgetDay = "";
let callsToday = 0;

/**
 * Reserves one Gemini call: within the daily cap, and within the per-minute rate (waiting up to
 * `maxWaitMs` for a slot, so a burst of agent turns queues instead of failing with HTTP 429).
 */
export async function takeAiCall(kind: ModelKind = "main", maxWaitMs = 8_000): Promise<boolean> {
  if (aiMode() === "demo") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    callsToday = 0;
  }
  if (callsToday >= DAILY_LIMIT) return false;

  const deadline = Date.now() + maxWaitMs;
  const model = modelId(kind);
  const window = recent.get(model) ?? [];
  recent.set(model, window);
  for (;;) {
    const now = Date.now();
    while (window.length && now - window[0] >= 60_000) window.shift();
    if (window.length < rpm(model)) {
      window.push(now);
      callsToday++;
      return true;
    }
    const wait = 60_000 - (now - window[0]) + 50;
    if (now + wait > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}
