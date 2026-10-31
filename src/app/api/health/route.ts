import { connection } from "next/server";
import { aiMode } from "@/ai/model";
import { paypalMode } from "@/paypal/client";

export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    paypal: paypalMode(),
    ai: aiMode(),
    database: process.env.DATABASE_URL ? "postgres" : "pglite",
  });
}
