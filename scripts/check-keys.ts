// `npm run check:keys`: loads .env.local the same way Next.js does and checks that each key
// actually works. Prints only pass/fail, never the values.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function checkPayPal() {
  const { paypalMode, paypalFetch } = await import("../src/paypal/client");
  if (paypalMode() === "mock") return "skipped (PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set: mock mode)";
  // Listing webhooks needs a valid token and nothing else.
  await paypalFetch("/v1/notifications/webhooks", { method: "GET" });
  return "ok (sandbox token issued)";
}

async function checkGemini() {
  const { aiMode, geminiModel, DEFAULT_GEMINI_MODEL } = await import("../src/ai/model");
  if (aiMode() === "demo") return "skipped (GOOGLE_GENERATIVE_AI_API_KEY not set: demo mode)";
  const { generateText } = await import("ai");
  const { text } = await generateText({ model: geminiModel(), prompt: "Reply with the single word: ready" });
  return `ok (${process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL} replied "${text.trim().slice(0, 20)}")`;
}

async function main() {
  for (const [name, check] of [
    ["PayPal", checkPayPal],
    ["Gemini", checkGemini],
  ] as const) {
    try {
      console.log(`${name}: ${await check()}`);
    } catch (err) {
      const e = err as { status?: number; statusCode?: number; message?: string };
      console.log(`${name}: FAILED (${e.status ?? e.statusCode ?? ""} ${e.message ?? err})`.replace(/\s+/g, " "));
    }
  }
}

main();
