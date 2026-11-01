import { connection } from "next/server";
import { paypalMode } from "@/paypal/client";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

// Browser-safe token for the PayPal JS SDK v6 (valid 15 minutes, limited to our domain).
export async function GET(request: Request) {
  await connection();
  if (paypalMode() === "mock") return Response.json({ mode: "mock" });

  const params = new URLSearchParams({ grant_type: "client_credentials", response_type: "client_token", intent: "sdk_init" });
  // Lock the token to our domain when deployed. PayPal rejects "localhost" as a domain, so
  // local development gets an unrestricted (still 15-minute) token.
  const domain = new URL(request.url).hostname;
  if (domain.includes(".") && !/^\d+\.\d+\.\d+\.\d+$/.test(domain)) params.append("domains[]", domain);

  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) return Response.json({ error: "Couldn't start PayPal" }, { status: 502 });
  const { access_token } = (await res.json()) as { access_token: string };
  return Response.json({ mode: "sandbox", clientToken: access_token });
}
