import { z } from "zod";
import { getDb } from "@/db";
import { DonationError, startDonation } from "@/services/donations";

const body = z.object({
  poolId: z.string().min(1),
  amountCents: z.number().int(),
  donorName: z.string().max(80).default(""),
  donorEmail: z.email(),
  anonymous: z.boolean().default(false),
  tripId: z.string().optional(),
});

// Creates the PayPal order for a donation. The amount and fund are stored server-side.
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Check the amount and email." }, { status: 400 });
  try {
    return Response.json(await startDonation(getDb(), parsed.data));
  } catch (err) {
    if (err instanceof DonationError) return Response.json({ error: err.message }, { status: 400 });
    console.error("startDonation failed", err);
    return Response.json({ error: "PayPal isn't reachable right now." }, { status: 502 });
  }
}
