import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { confirmSubscription } from "@/services/subscriptions";

// PayPal sends the restaurant back here after approving the compliance plan.
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("r") ?? "";
  const subscriptionId = request.nextUrl.searchParams.get("subscription_id") ?? "";
  let outcome = "error";
  try {
    const { active } = await confirmSubscription(getDb(), restaurantId, subscriptionId);
    outcome = active ? "active" : "pending";
  } catch (err) {
    console.error("Subscription confirmation failed", err);
  }
  redirect(`/restaurant?r=${encodeURIComponent(restaurantId)}&plan=${outcome}`);
}
