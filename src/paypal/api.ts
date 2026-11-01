import { centsToPaypalValue, paypalValueToCents } from "@/domain/stipend";
import { mockId, paypalFetch, paypalMode } from "./client";

export type Capture = { captureId: string; orderId: string; amountCents: number; customId: string };

// Orders v2: donors' "sponsor a rescue". custom_id carries the pool id the money belongs to.
export async function createOrder(input: {
  amountCents: number;
  customId: string;
  description: string;
}): Promise<{ orderId: string }> {
  if (paypalMode() === "mock") return { orderId: mockId("ORDER") };

  const order = await paypalFetch<{ id: string }>("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: input.customId,
          description: input.description,
          amount: { currency_code: "USD", value: centsToPaypalValue(input.amountCents) },
        },
      ],
    },
  });
  return { orderId: order.id };
}

type OrderCaptureResponse = {
  id: string;
  purchase_units: {
    payments: { captures: { id: string; status: string; custom_id?: string; amount: { value: string } }[] };
  }[];
};

export async function captureOrder(
  orderId: string,
  mock?: { amountCents: number; customId: string },
): Promise<Capture> {
  if (paypalMode() === "mock") {
    if (!mock) throw new Error("Mock capture needs amount and customId");
    return { captureId: mockId("CAPTURE"), orderId, ...mock };
  }

  const res = await paypalFetch<OrderCaptureResponse>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    requestId: `capture-${orderId}`,
  });
  const capture = res.purchase_units[0].payments.captures[0];
  return {
    captureId: capture.id,
    orderId: res.id,
    amountCents: paypalValueToCents(capture.amount.value),
    customId: capture.custom_id ?? "",
  };
}

export type PayoutReceiver = { wallet: "paypal"; email: string } | { wallet: "venmo"; phone: string };

// Payouts API: the driver's stipend. sender_batch_id is the trip id, so a retried payout for the
// same trip is rejected by PayPal instead of paying twice.
export async function createPayout(input: {
  tripId: string;
  amountCents: number;
  receiver: PayoutReceiver;
  note: string;
}): Promise<{ batchId: string; itemId: string | null }> {
  if (paypalMode() === "mock") return { batchId: mockId("PAYOUT"), itemId: mockId("ITEM") };

  const item =
    input.receiver.wallet === "venmo"
      ? { recipient_type: "PHONE", receiver: input.receiver.phone, recipient_wallet: "VENMO" }
      : { recipient_type: "EMAIL", receiver: input.receiver.email, recipient_wallet: "PAYPAL" };

  const res = await paypalFetch<{ batch_header: { payout_batch_id: string } }>("/v1/payments/payouts", {
    method: "POST",
    body: {
      sender_batch_header: {
        sender_batch_id: `trip-${input.tripId}`,
        email_subject: "Your MealBridge fuel reimbursement",
        email_message: input.note,
      },
      items: [
        {
          ...item,
          amount: { currency: "USD", value: centsToPaypalValue(input.amountCents) },
          note: input.note,
          sender_item_id: input.tripId,
        },
      ],
    },
  });
  return { batchId: res.batch_header.payout_batch_id, itemId: null };
}

export type PayoutItemStatus =
  | "SUCCESS"
  | "PENDING"
  | "UNCLAIMED"
  | "ONHOLD"
  | "FAILED"
  | "RETURNED"
  | "BLOCKED"
  | "REFUNDED"
  | "REVERSED"
  | "DENIED";

// Asks PayPal for a payout's state directly, so the ledger settles even if a webhook never arrives
// (or before webhooks are set up, when running locally).
export async function getPayoutItemStatus(batchId: string): Promise<PayoutItemStatus | null> {
  if (paypalMode() === "mock" || batchId.startsWith("MOCK-")) return "SUCCESS";
  const res = await paypalFetch<{ items?: { transaction_status: PayoutItemStatus }[] }>(
    `/v1/payments/payouts/${batchId}`,
    { method: "GET" },
  );
  return res.items?.[0]?.transaction_status ?? null;
}

// Rejects forged webhooks: PayPal checks the signature headers against our webhook id.
export async function verifyWebhookSignature(headers: Headers, event: unknown): Promise<boolean> {
  if (paypalMode() === "mock") return true;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const res = await paypalFetch<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: {
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      },
    },
  );
  return res.verification_status === "SUCCESS";
}
