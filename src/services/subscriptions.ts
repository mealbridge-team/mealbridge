import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { appSettings, fundingPools, restaurants } from "@/db/schema";
import {
  cancelSubscription,
  createCompliancePlan,
  createSubscription,
  getSubscription,
  subscriptionPayments,
} from "@/paypal/billing";
import { mockId, paypalMode } from "@/paypal/client";
import { paypalValueToCents } from "@/domain/stipend";
import { fundAndDispatch } from "./donations";
import { recordIncoming } from "./treasury";

export const COMPLIANCE_PLAN_CENTS = 2500;

export class SubscriptionError extends Error {}

// The billing plan is created in PayPal once per REST app and remembered; demo resets keep it.
async function compliancePlanId(db: Db): Promise<string> {
  const key = `paypal:${paypalMode()}:${(process.env.PAYPAL_CLIENT_ID ?? "").slice(-8)}:compliance-plan`;
  const [saved] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  if (saved) return saved.value;
  const { planId } = await createCompliancePlan(COMPLIANCE_PLAN_CENTS);
  await db.insert(appSettings).values({ key, value: planId }).onConflictDoNothing();
  const [winner] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return winner.value;
}

async function restaurantPool(db: Db, restaurant: { id: string; name: string }) {
  const [pool] = await db.select().from(fundingPools).where(eq(fundingPools.restaurantId, restaurant.id));
  if (pool) return pool;
  const [created] = await db
    .insert(fundingPools)
    .values({ kind: "restaurant", label: `${restaurant.name} compliance plan`, restaurantId: restaurant.id })
    .returning();
  return created;
}

// Step 1: create the subscription and send the restaurant to PayPal to approve it.
export async function startSubscription(db: Db, restaurantId: string, origin: string) {
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  if (!restaurant) throw new SubscriptionError("Unknown restaurant.");
  if (restaurant.plan === "compliance") throw new SubscriptionError("This restaurant is already on the compliance plan.");

  const back = `${origin}/restaurant?r=${restaurant.id}`;
  const { subscriptionId, approveUrl } = await createSubscription({
    planId: await compliancePlanId(db),
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    returnUrl: `${origin}/api/subscriptions/return?r=${restaurant.id}`,
    cancelUrl: `${back}&plan=cancelled`,
  });
  await db
    .update(restaurants)
    .set({ paypalSubscriptionId: subscriptionId, subscriptionStatus: "APPROVAL_PENDING" })
    .where(eq(restaurants.id, restaurant.id));

  if (!approveUrl) {
    // Mock mode: there is no PayPal page to visit, so activate straight away with a mock payment.
    await activate(db, restaurant.id, subscriptionId, "ACTIVE");
    await recordPlanPayment(db, restaurant.id, { id: mockId("SALE"), amountCents: COMPLIANCE_PLAN_CENTS });
    return { redirectTo: `${back}&plan=active` };
  }
  return { redirectTo: approveUrl };
}

async function activate(db: Db, restaurantId: string, subscriptionId: string, status: string) {
  await db
    .update(restaurants)
    .set({ plan: "compliance", paypalSubscriptionId: subscriptionId, subscriptionStatus: status })
    .where(eq(restaurants.id, restaurantId));
}

async function recordPlanPayment(db: Db, restaurantId: string, payment: { id: string; amountCents: number }) {
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  const pool = await restaurantPool(db, restaurant);
  const isNew = await recordIncoming(db, {
    poolId: pool.id,
    amountCents: payment.amountCents,
    source: "restaurant_subscription",
    paypalRef: payment.id,
    restaurantId,
    memo: "SB 1383 compliance plan payment",
  });
  if (isNew) await fundAndDispatch(db);
  return isNew;
}

// Step 2: PayPal sends the restaurant back here. We check the subscription ourselves rather than
// trusting the redirect, then record any payment already taken (the webhook may come later).
export async function confirmSubscription(db: Db, restaurantId: string, subscriptionId: string) {
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  if (!restaurant || restaurant.paypalSubscriptionId !== subscriptionId) {
    throw new SubscriptionError("That subscription doesn't belong to this restaurant.");
  }
  const sub = await getSubscription(subscriptionId);
  if (sub.customId !== restaurantId) throw new SubscriptionError("That subscription doesn't belong to this restaurant.");
  if (sub.status !== "ACTIVE" && sub.status !== "APPROVED") {
    await db.update(restaurants).set({ subscriptionStatus: sub.status }).where(eq(restaurants.id, restaurantId));
    return { active: false, status: sub.status };
  }
  await activate(db, restaurantId, subscriptionId, sub.status);
  await syncPlanPayments(db, restaurantId);
  return { active: true, status: sub.status };
}

export async function syncPlanPayments(db: Db, restaurantId: string) {
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  const subId = restaurant?.paypalSubscriptionId;
  if (!subId || subId.startsWith("MOCK-") || paypalMode() === "mock") return 0;
  const since = new Date(Date.now() - 40 * 24 * 3_600_000);
  let recorded = 0;
  for (const payment of await subscriptionPayments(subId, since)) {
    if (await recordPlanPayment(db, restaurantId, payment)) recorded++;
  }
  return recorded;
}

// Catch-up for every active plan, in case a PAYMENT.SALE.COMPLETED webhook was missed or is late.
export async function syncAllPlanPayments(db: Db) {
  const onPlan = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.plan, "compliance"));
  let recorded = 0;
  for (const { id } of onPlan) {
    try {
      recorded += await syncPlanPayments(db, id);
    } catch (err) {
      console.error("plan payment sync failed", id, err);
    }
  }
  return recorded;
}

export async function endSubscription(db: Db, restaurantId: string) {
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
  if (!restaurant || restaurant.plan !== "compliance") return;
  if (restaurant.paypalSubscriptionId) await cancelSubscription(restaurant.paypalSubscriptionId);
  await db
    .update(restaurants)
    .set({ plan: "free", subscriptionStatus: "CANCELLED" })
    .where(eq(restaurants.id, restaurantId));
}

// Webhooks: BILLING.SUBSCRIPTION.* and PAYMENT.SALE.COMPLETED.
export async function handleSubscriptionEvent(
  db: Db,
  eventType: string,
  resource: { id?: string; custom_id?: string; status?: string; billing_agreement_id?: string; amount?: { total?: string } },
): Promise<boolean> {
  if (eventType === "PAYMENT.SALE.COMPLETED") {
    if (!resource.billing_agreement_id || !resource.id || !resource.amount?.total) return false;
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.paypalSubscriptionId, resource.billing_agreement_id));
    if (!restaurant) return false;
    await recordPlanPayment(db, restaurant.id, {
      id: resource.id,
      amountCents: paypalValueToCents(resource.amount.total),
    });
    return true;
  }

  if (!resource.id || !resource.custom_id) return false;
  const match = and(eq(restaurants.id, resource.custom_id), eq(restaurants.paypalSubscriptionId, resource.id));
  if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
    await db.update(restaurants).set({ plan: "compliance", subscriptionStatus: "ACTIVE" }).where(match);
    return true;
  }
  if (["BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED", "BILLING.SUBSCRIPTION.EXPIRED"].includes(eventType)) {
    await db.update(restaurants).set({ plan: "free", subscriptionStatus: resource.status ?? "CANCELLED" }).where(match);
    return true;
  }
  return false;
}
