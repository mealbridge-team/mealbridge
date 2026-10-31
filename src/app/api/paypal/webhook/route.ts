import { getDb } from "@/db";
import { verifyWebhookSignature } from "@/paypal/api";
import { processPayPalEvent, type PayPalEvent } from "@/services/webhooks";

export async function POST(request: Request) {
  const event = (await request.json()) as PayPalEvent;
  if (!(await verifyWebhookSignature(request.headers, event))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  const result = await processPayPalEvent(getDb(), event);
  return Response.json({ result });
}
