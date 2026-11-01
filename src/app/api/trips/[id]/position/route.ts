import { getDb } from "@/db";
import { allow } from "@/lib/rate-limit";
import { recordPosition } from "@/services/tracking";

// The driver's phone (or the demo's simulated drive) reports where it is while a trip is active.
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[id]/position">) {
  const { id } = await ctx.params;
  if (!allow(`position:${id}`, 40, 60_000)) return Response.json({ error: "Too many updates" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as
    | { driverId?: unknown; lat?: unknown; lng?: unknown; simulated?: unknown }
    | null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!body || typeof body.driverId !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "Send driverId, lat and lng" }, { status: 400 });
  }
  const saved = await recordPosition(getDb(), { tripId: id, driverId: body.driverId, lat, lng, simulated: body.simulated === true });
  return saved ? Response.json({ ok: true }) : Response.json({ error: "This trip isn't on the road" }, { status: 409 });
}
