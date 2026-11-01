import { connection } from "next/server";
import { getDb } from "@/db";
import { liveTrips } from "@/services/tracking";

// Polled by the live maps on the coordinator and shelter screens.
export async function GET() {
  await connection();
  return Response.json({ trips: await liveTrips(getDb()) });
}
