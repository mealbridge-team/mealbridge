import { generateText } from "ai";
import { connection } from "next/server";
import { geminiModel, takeAiCall } from "@/ai/model";
import { getDb } from "@/db";
import { impactData, type RescueRow } from "@/lib/impact-data";
import { tripViews } from "@/lib/queries";
import { allow } from "@/lib/rate-limit";
import { poolBalances } from "@/services/treasury";
import { liveTrips } from "@/services/tracking";

// The Insights agent on the impact page: one question in, one short answer out, grounded in the same
// public-safe numbers the page shows plus what's on the road tonight. The key never leaves the server.

const INSTRUCTIONS = `You are the MealBridge Insights agent, an analyst for a food-rescue nonprofit in the San Francisco Bay Area.
Restaurants post surplus food; a Matcher picks a shelter; the trip's driver reimbursement is reserved before dispatch from (1) the restaurant's compliance plan, (2) area donors, (3) sponsors and city grants, (4) the general fund; drivers are reimbursed through PayPal Payouts once photo, GPS and the shelter's confirmation agree.
Answer the question using only the JSON data you are given. Lead with the answer and the number, in at most four short sentences of plain text (no markdown, no lists).
Never invent figures; if the data can't answer it, say so and suggest what it can answer. Shelter labels are deliberately approximate for privacy; never speculate about locations.`;

const sum = (rows: RescueRow[], pick: (r: RescueRow) => number) => Math.round(rows.reduce((s, r) => s + pick(r), 0) * 100) / 100;

function group<T>(rows: T[], key: (r: T) => string, value: (r: T) => number) {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = Math.round(((out[key(r)] ?? 0) + value(r)) * 100) / 100;
  return out;
}

async function facts() {
  const db = getDb();
  const since = Date.now() - 14 * 3_600_000;
  const [{ rescues, money, funds }, recent, pools, live] = await Promise.all([impactData(db), tripViews(db, { limit: 60 }), poolBalances(db), liveTrips(db)]);
  const delivered = rescues.filter((r) => r.outcome === "Delivered");
  const timed = delivered.filter((r) => r.minutesToDeliver != null);
  return {
    totals: {
      deliveries: delivered.length,
      meals: sum(delivered, (r) => r.meals),
      pounds: sum(delivered, (r) => r.pounds),
      reimbursedUsd: sum(delivered, (r) => r.reimbursementUsd),
      averageMinutesPostToPlate: timed.length ? Math.round(sum(timed, (r) => r.minutesToDeliver ?? 0) / timed.length) : null,
      turnedAwayForFoodSafety: rescues.filter((r) => r.outcome.startsWith("Turned away")).length,
    },
    mealsByArea: group(delivered, (r) => r.area, (r) => r.meals),
    mealsByWeek: group(delivered, (r) => r.week, (r) => r.meals),
    mealsByRestaurant: group(delivered, (r) => r.restaurant, (r) => r.meals),
    mealsByDriver: group(delivered, (r) => r.driver, (r) => r.meals),
    mealsByWeekday: group(delivered, (r) => r.weekday, (r) => r.meals),
    reimbursementByFunder: group(delivered, (r) => r.fundedBy, (r) => r.reimbursementUsd),
    reimbursementByAreaAndFunder: group(delivered, (r) => `${r.area}: ${r.fundedBy}`, (r) => r.reimbursementUsd),
    moneyByFlowUsd: group(money, (m) => `${m.direction}: ${m.flow}`, (m) => m.amountUsd),
    moneyByWeekUsd: group(money, (m) => `${m.week} ${m.direction}`, (m) => m.amountUsd),
    fundsAvailableNow: funds,
    tonight: {
      rescues: recent
        .filter((t) => t.trip.createdAt.getTime() > since)
        .map((t) => ({ restaurant: t.restaurant.name, area: t.restaurant.area, shelter: t.shelter.publicLabel, portions: t.listing.totalPortions, status: t.trip.status, reimbursementUsd: t.trip.stipendCents / 100, fundedBy: t.funding.map((f) => f.label) })),
      onTheRoad: live.map((t) => ({ driver: t.driverName, status: t.status, etaMinutes: t.etaMinutes })),
      fundsAvailable: pools.map((p) => ({ fund: p.label, availableUsd: p.availableCents / 100 })),
    },
  };
}

export async function POST(request: Request) {
  await connection();
  let question = "";
  try {
    question = String(((await request.json()) as { question?: unknown }).question ?? "").trim().slice(0, 400);
  } catch {
    // Falls through to the empty-question reply.
  }
  if (!question) return Response.json({ error: "Ask a question about the numbers on this page." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(`ask:${ip}`, 20, 10 * 60_000)) {
    return Response.json({ error: "Lots of questions at once from you. Give it a minute and ask again." }, { status: 429 });
  }

  const data = await facts();
  if (!(await takeAiCall("fast", 20_000))) {
    const t = data.totals;
    return Response.json({
      answer: `The Insights agent is resting (Gemini is busy or off in this demo), so here are the headline numbers instead: ${t.meals.toLocaleString("en-US")} meals over ${t.deliveries} deliveries, ${t.pounds.toLocaleString("en-US")} lb of food, and $${t.reimbursedUsd.toFixed(2)} reimbursed to drivers.`,
      fallback: true,
    });
  }

  try {
    const { text } = await generateText({
      model: geminiModel("fast"),
      system: INSTRUCTIONS,
      prompt: `Data (JSON):\n${JSON.stringify(data)}\n\nQuestion: ${question}`,
      maxOutputTokens: 400,
    });
    return Response.json({ answer: text.trim() || "I couldn't find an answer to that in the data." });
  } catch (err) {
    console.error("[insights] ask failed", err);
    return Response.json({ error: "The Insights agent couldn't answer just now. Try again in a moment." }, { status: 502 });
  }
}
