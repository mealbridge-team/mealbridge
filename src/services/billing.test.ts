import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, runMigrations } from "@/db";
import { resetDemoData } from "@/db/seed";
import { ledgerEntries, restaurants, sponsors } from "@/db/schema";
import { invoiceSponsor, InvoiceError, simulateInvoicePayment } from "./invoices";
import { COMPLIANCE_PLAN_CENTS, endSubscription, startSubscription } from "./subscriptions";
import { processPayPalEvent } from "./webhooks";
import { poolBalances } from "./treasury";

const db = getDb();

beforeAll(async () => {
  await runMigrations(db);
  await resetDemoData(db);
});

async function restaurant(name: string) {
  const [row] = await db.select().from(restaurants).where(eq(restaurants.name, name));
  return row;
}

describe("restaurant compliance plan (mock PayPal)", () => {
  it("activates the plan, opens a fund for the restaurant and records the first payment", async () => {
    const saffron = await restaurant("Saffron & Steel Kitchen");
    const { redirectTo } = await startSubscription(db, saffron.id, "http://localhost:3000");
    expect(redirectTo).toContain("plan=active");

    const after = await restaurant("Saffron & Steel Kitchen");
    expect(after.plan).toBe("compliance");
    const pool = (await poolBalances(db)).find((p) => p.restaurantId === saffron.id);
    expect(pool?.availableCents).toBe(COMPLIANCE_PLAN_CENTS);
  });

  it("records a renewal from the webhook once, even if PayPal sends it twice", async () => {
    const saffron = await restaurant("Saffron & Steel Kitchen");
    const event = {
      id: "WH-SALE-1",
      event_type: "PAYMENT.SALE.COMPLETED",
      resource: { id: "SALE-RENEWAL-1", billing_agreement_id: saffron.paypalSubscriptionId, amount: { total: "25.00" } },
    };
    expect(await processPayPalEvent(db, event as never)).toBe("processed");
    expect(await processPayPalEvent(db, { ...event, id: "WH-SALE-1-replay" } as never)).toBe("processed");
    const sales = await db.select().from(ledgerEntries).where(eq(ledgerEntries.paypalRef, "SALE-RENEWAL-1"));
    expect(sales).toHaveLength(1);
  });

  it("goes back to the free plan when cancelled", async () => {
    const saffron = await restaurant("Saffron & Steel Kitchen");
    await endSubscription(db, saffron.id);
    expect((await restaurant("Saffron & Steel Kitchen")).plan).toBe("free");
  });
});

describe("sponsor invoices (mock PayPal)", () => {
  it("adds paid invoices to the sponsor's fund exactly once", async () => {
    const [corporate] = await db.select().from(sponsors).where(eq(sponsors.name, "Brightline Logistics"));
    const before = (await poolBalances(db)).find((p) => p.label === corporate.name)!.availableCents;

    const invoice = await invoiceSponsor(db, { sponsorId: corporate.id, amountCents: 5_000, memo: "" });
    expect(invoice.status).toBe("sent");
    expect(await simulateInvoicePayment(db, invoice.id)).toBe(true);
    expect(await simulateInvoicePayment(db, invoice.id)).toBe(false);

    const after = (await poolBalances(db)).find((p) => p.label === corporate.name)!.availableCents;
    expect(after - before).toBe(5_000);
  });

  it("rejects amounts outside the allowed range", async () => {
    const [corporate] = await db.select().from(sponsors).limit(1);
    await expect(invoiceSponsor(db, { sponsorId: corporate.id, amountCents: 50, memo: "" })).rejects.toBeInstanceOf(InvoiceError);
  });
});
