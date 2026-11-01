import { connection } from "next/server";
import { getDb } from "@/db";
import { tripViews } from "@/lib/queries";
import { poolBalances } from "@/services/treasury";
import { liveTrips } from "@/services/tracking";

// Live operations snapshot for the Insights agent's get_tonight tool. Public-safe fields only.
export async function GET() {
  await connection();
  const db = getDb();
  const since = Date.now() - 14 * 3_600_000;
  const [recent, pools, live] = await Promise.all([tripViews(db, { limit: 60 }), poolBalances(db), liveTrips(db)]);
  const tonight = recent.filter((t) => t.trip.createdAt.getTime() > since);
  return Response.json({
    rescuesTonight: tonight.map((t) => ({
      restaurant: t.restaurant.name,
      area: t.restaurant.area,
      shelter: t.shelter.publicLabel,
      portions: t.listing.totalPortions,
      status: t.trip.status,
      reimbursementUsd: t.trip.stipendCents / 100,
      fundedBy: t.funding.map((f) => f.label),
    })),
    onTheRoad: live.map((t) => ({ driver: t.driverName, status: t.status, etaMinutes: t.etaMinutes })),
    funds: pools.map((p) => ({ fund: p.label, availableUsd: p.availableCents / 100 })),
  });
}
