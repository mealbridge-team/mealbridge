import { z } from "zod";
import { getDb } from "@/db";
import { completeDonation, DonationError } from "@/services/donations";

const body = z.object({ orderId: z.string().min(1) });

// Called after the donor approves in PayPal: capture, record, then fund and dispatch waiting trips.
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Missing order." }, { status: 400 });
  try {
    return Response.json(await completeDonation(getDb(), parsed.data.orderId));
  } catch (err) {
    if (err instanceof DonationError) return Response.json({ error: err.message }, { status: 409 });
    console.error("completeDonation failed", err);
    return Response.json({ error: "PayPal couldn't complete the payment." }, { status: 502 });
  }
}
