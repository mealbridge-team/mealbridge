import { and, count, desc, eq, sum } from "drizzle-orm";
import type { Db } from "@/db";
import { fundingPools, listings, matches, reservations, sponsorInvoices, sponsors, trips } from "@/db/schema";
import { draftNudge } from "@/agents/nudge";
import { formatUsd } from "@/domain/stipend";
import { getInvoice, readInvoice, remindInvoice, sendSponsorInvoice } from "@/paypal/billing";
import { paypalMode } from "@/paypal/client";
import { fundAndDispatch } from "./donations";
import { recordIncoming } from "./treasury";

export class InvoiceError extends Error {}

export const MIN_INVOICE_CENTS = 1_000;
export const MAX_INVOICE_CENTS = 500_000;

// Sponsors are fictional, so invoices go to a sandbox account you control (DEMO_SPONSOR_EMAIL).
function recipientEmail(sponsor: { contactEmail: string }) {
  return process.env.DEMO_SPONSOR_EMAIL || sponsor.contactEmail;
}

export async function invoiceSponsor(db: Db, input: { sponsorId: string; amountCents: number; memo: string }) {
  if (!Number.isInteger(input.amountCents) || input.amountCents < MIN_INVOICE_CENTS || input.amountCents > MAX_INVOICE_CENTS) {
    throw new InvoiceError("Invoices must be between $10 and $5,000.");
  }
  const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, input.sponsorId));
  if (!sponsor) throw new InvoiceError("Unknown sponsor.");
  const [pool] = await db.select().from(fundingPools).where(eq(fundingPools.sponsorId, sponsor.id));
  if (!pool) throw new InvoiceError("This sponsor has no fund yet.");

  const memo = input.memo.trim().slice(0, 200) || `Food-rescue trips funded by ${sponsor.name}`;
  const sent = await sendSponsorInvoice({
    sponsorName: sponsor.name,
    sponsorEmail: recipientEmail(sponsor),
    amountCents: input.amountCents,
    memo,
    reference: `pool:${pool.id}`,
  });
  const [invoice] = await db
    .insert(sponsorInvoices)
    .values({
      sponsorId: sponsor.id,
      poolId: pool.id,
      amountCents: input.amountCents,
      memo,
      paypalInvoiceId: sent.invoiceId,
      invoiceNumber: sent.invoiceNumber,
      payerViewUrl: sent.payerViewUrl,
    })
    .returning();
  return invoice;
}

// Paid money goes to the sponsor's pool once; the webhook and the "check" button share this.
async function markPaid(db: Db, paypalInvoiceId: string, paidCents: number) {
  const [invoice] = await db.select().from(sponsorInvoices).where(eq(sponsorInvoices.paypalInvoiceId, paypalInvoiceId));
  if (!invoice || invoice.status === "cancelled") return false;
  const isNew = await recordIncoming(db, {
    poolId: invoice.poolId,
    amountCents: paidCents || invoice.amountCents,
    source: "sponsor_invoice",
    paypalRef: paypalInvoiceId,
    sponsorId: invoice.sponsorId,
    memo: `Invoice ${invoice.invoiceNumber}`,
  });
  await db.update(sponsorInvoices).set({ status: "paid", paidAt: invoice.paidAt ?? new Date() }).where(eq(sponsorInvoices.id, invoice.id));
  if (isNew) await fundAndDispatch(db);
  return isNew;
}

export async function refreshInvoices(db: Db) {
  const open = await db.select().from(sponsorInvoices).where(eq(sponsorInvoices.status, "sent"));
  let paid = 0;
  for (const invoice of open) {
    if (invoice.paypalInvoiceId.startsWith("MOCK-") || paypalMode() === "mock") continue;
    const info = await getInvoice(invoice.paypalInvoiceId);
    if (info.payerViewUrl && info.payerViewUrl !== invoice.payerViewUrl) {
      await db.update(sponsorInvoices).set({ payerViewUrl: info.payerViewUrl }).where(eq(sponsorInvoices.id, invoice.id));
    }
    if ((info.status === "PAID" || info.status === "MARKED_AS_PAID") && (await markPaid(db, invoice.paypalInvoiceId, info.paidCents))) paid++;
    if (info.status === "CANCELLED") {
      await db.update(sponsorInvoices).set({ status: "cancelled" }).where(eq(sponsorInvoices.id, invoice.id));
    }
  }
  return paid;
}

// Mock mode only: stands in for the sponsor paying, since there is no PayPal page to pay on.
export async function simulateInvoicePayment(db: Db, invoiceId: string) {
  const [invoice] = await db.select().from(sponsorInvoices).where(eq(sponsorInvoices.id, invoiceId));
  if (!invoice || !invoice.paypalInvoiceId.startsWith("MOCK-")) throw new InvoiceError("Only demo invoices can be simulated.");
  return markPaid(db, invoice.paypalInvoiceId, invoice.amountCents);
}

// Facts for the Nudge agent: what this sponsor's money has already done, from the ledger.
export async function draftReminder(db: Db, invoiceId: string) {
  const [row] = await db
    .select({ invoice: sponsorInvoices, sponsor: sponsors })
    .from(sponsorInvoices)
    .innerJoin(sponsors, eq(sponsors.id, sponsorInvoices.sponsorId))
    .where(eq(sponsorInvoices.id, invoiceId));
  if (!row || row.invoice.status !== "sent") throw new InvoiceError("Only unpaid invoices can be reminded.");

  const [funded] = await db
    .select({ trips: count(), meals: sum(listings.totalPortions) })
    .from(reservations)
    .innerJoin(trips, eq(trips.id, reservations.tripId))
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .where(and(eq(reservations.poolId, row.invoice.poolId), eq(reservations.status, "paid")));
  const [waiting] = await db.select({ n: count() }).from(trips).where(eq(trips.status, "unfunded"));

  return draftNudge({
    sponsorName: row.sponsor.name,
    invoiceNumber: row.invoice.invoiceNumber,
    amountUsd: formatUsd(row.invoice.amountCents),
    daysOutstanding: Math.floor((Date.now() - row.invoice.createdAt.getTime()) / 86_400_000),
    tripsFundedSoFar: funded?.trips ?? 0,
    mealsFundedSoFar: Number(funded?.meals ?? 0),
    waitingTrips: waiting?.n ?? 0,
  });
}

export async function sendReminder(db: Db, invoiceId: string, note: string) {
  const [invoice] = await db.select().from(sponsorInvoices).where(eq(sponsorInvoices.id, invoiceId));
  if (!invoice || invoice.status !== "sent") throw new InvoiceError("Only unpaid invoices can be reminded.");
  await remindInvoice(invoice.paypalInvoiceId, note.slice(0, 500));
}

export async function handleInvoiceEvent(db: Db, eventType: string, resource: Record<string, unknown>) {
  if (eventType !== "INVOICING.INVOICE.PAID") return false;
  // v2 invoicing events wrap the invoice in resource.invoice; older ones send it bare.
  const invoice = (resource.invoice ?? resource) as Parameters<typeof readInvoice>[0];
  if (!invoice?.id) return false;
  await markPaid(db, invoice.id, readInvoice(invoice).paidCents);
  return true;
}

export async function invoiceViews(db: Db) {
  return db
    .select({ invoice: sponsorInvoices, sponsor: sponsors })
    .from(sponsorInvoices)
    .innerJoin(sponsors, eq(sponsors.id, sponsorInvoices.sponsorId))
    .orderBy(desc(sponsorInvoices.createdAt))
    .limit(20);
}

