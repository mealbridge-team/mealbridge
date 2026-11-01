import { centsToPaypalValue, paypalValueToCents } from "@/domain/stipend";
import { mockId, paypalFetch, paypalMode } from "./client";

// Subscriptions API: the restaurant's optional SB 1383 compliance plan.

export async function createCompliancePlan(priceCents: number): Promise<{ productId: string; planId: string }> {
  if (paypalMode() === "mock") return { productId: mockId("PROD"), planId: mockId("PLAN") };

  const product = await paypalFetch<{ id: string }>("/v1/catalogs/products", {
    method: "POST",
    body: {
      name: "MealBridge SB 1383 compliance plan",
      description: "Monthly food-recovery records for California SB 1383, and funded pickups.",
      type: "SERVICE",
      category: "SOFTWARE",
    },
  });
  const plan = await paypalFetch<{ id: string }>("/v1/billing/plans", {
    method: "POST",
    body: {
      product_id: product.id,
      name: "SB 1383 compliance plan",
      description: "Covers your restaurant's rescue trips and keeps your SB 1383 donation records.",
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: centsToPaypalValue(priceCents), currency_code: "USD" } },
        },
      ],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 2 },
    },
  });
  return { productId: product.id, planId: plan.id };
}

type Link = { href: string; rel: string };

export async function createSubscription(input: {
  planId: string;
  restaurantId: string;
  restaurantName: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ subscriptionId: string; approveUrl: string | null }> {
  if (paypalMode() === "mock") return { subscriptionId: mockId("SUB"), approveUrl: null };

  const sub = await paypalFetch<{ id: string; links: Link[] }>("/v1/billing/subscriptions", {
    method: "POST",
    body: {
      plan_id: input.planId,
      custom_id: input.restaurantId,
      application_context: {
        brand_name: "MealBridge",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    },
  });
  return { subscriptionId: sub.id, approveUrl: sub.links.find((l) => l.rel === "approve")?.href ?? null };
}

export type SubscriptionInfo = { id: string; status: string; customId: string | null; planId: string };

export async function getSubscription(subscriptionId: string): Promise<SubscriptionInfo> {
  const sub = await paypalFetch<{ id: string; status: string; custom_id?: string; plan_id: string }>(
    `/v1/billing/subscriptions/${subscriptionId}`,
    { method: "GET" },
  );
  return { id: sub.id, status: sub.status, customId: sub.custom_id ?? null, planId: sub.plan_id };
}

export type SubscriptionPayment = { id: string; amountCents: number };

// Completed payments on a subscription. Their ids match PAYMENT.SALE.COMPLETED's resource id, so
// the ledger records each payment once whichever path sees it first.
export async function subscriptionPayments(subscriptionId: string, since: Date): Promise<SubscriptionPayment[]> {
  const params = new URLSearchParams({
    start_time: since.toISOString(),
    end_time: new Date(Date.now() + 60_000).toISOString(),
  });
  const res = await paypalFetch<{
    transactions?: { id: string; status: string; amount_with_breakdown: { gross_amount: { value: string } } }[];
  }>(`/v1/billing/subscriptions/${subscriptionId}/transactions?${params}`, { method: "GET" });
  return (res.transactions ?? [])
    .filter((t) => t.status === "COMPLETED")
    .map((t) => ({ id: t.id, amountCents: paypalValueToCents(t.amount_with_breakdown.gross_amount.value) }));
}

export async function cancelSubscription(subscriptionId: string) {
  if (paypalMode() === "mock" || subscriptionId.startsWith("MOCK-")) return;
  await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: { reason: "Cancelled from the MealBridge restaurant screen" },
  });
}

// Invoicing API: sponsors and city food-recovery grants are billed with PayPal invoices.

export type SentInvoice = { invoiceId: string; invoiceNumber: string; payerViewUrl: string | null };

export async function sendSponsorInvoice(input: {
  sponsorName: string;
  sponsorEmail: string;
  amountCents: number;
  memo: string;
  reference: string;
}): Promise<SentInvoice> {
  if (paypalMode() === "mock") {
    return { invoiceId: mockId("INV"), invoiceNumber: mockId("MB"), payerViewUrl: null };
  }

  const { invoice_number } = await paypalFetch<{ invoice_number: string }>(
    "/v2/invoicing/generate-next-invoice-number",
    { method: "POST" },
  );
  const draft = await paypalFetch<{ id: string }>("/v2/invoicing/invoices", {
    method: "POST",
    body: {
      detail: {
        invoice_number,
        reference: input.reference,
        currency_code: "USD",
        note: "Thank you for funding tonight's food rescues. Every dollar reimburses a volunteer driver.",
        memo: input.memo,
        payment_term: { term_type: "NET_10" },
      },
      invoicer: { business_name: "MealBridge" },
      primary_recipients: [{ billing_info: { business_name: input.sponsorName, email_address: input.sponsorEmail } }],
      items: [
        {
          name: "Food-rescue trip fund",
          description: input.memo,
          quantity: "1",
          unit_amount: { currency_code: "USD", value: centsToPaypalValue(input.amountCents) },
          unit_of_measure: "AMOUNT",
        },
      ],
    },
  });
  await paypalFetch(`/v2/invoicing/invoices/${draft.id}/send`, {
    method: "POST",
    body: { send_to_invoicer: false, send_to_recipient: true },
    requestId: `send-${draft.id}`,
  });
  const sent = await getInvoice(draft.id);
  return { invoiceId: draft.id, invoiceNumber: invoice_number, payerViewUrl: sent.payerViewUrl };
}

export type InvoiceInfo = { status: string; paidCents: number; payerViewUrl: string | null };

type InvoiceResource = {
  id: string;
  status: string;
  detail?: { metadata?: { recipient_view_url?: string } };
  payments?: { paid_amount?: { value: string } };
};

export function readInvoice(invoice: InvoiceResource): InvoiceInfo {
  return {
    status: invoice.status,
    paidCents: invoice.payments?.paid_amount ? paypalValueToCents(invoice.payments.paid_amount.value) : 0,
    payerViewUrl: invoice.detail?.metadata?.recipient_view_url ?? null,
  };
}

export async function getInvoice(invoiceId: string): Promise<InvoiceInfo> {
  return readInvoice(await paypalFetch<InvoiceResource>(`/v2/invoicing/invoices/${invoiceId}`, { method: "GET" }));
}

export async function remindInvoice(invoiceId: string, note: string) {
  if (paypalMode() === "mock" || invoiceId.startsWith("MOCK-")) return;
  await paypalFetch(`/v2/invoicing/invoices/${invoiceId}/remind`, {
    method: "POST",
    body: { subject: "A friendly note from MealBridge", note, send_to_invoicer: false },
  });
}
