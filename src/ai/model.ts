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
