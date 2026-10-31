// Thin PayPal REST client (sandbox). Without PAYPAL_CLIENT_ID/SECRET it runs in mock mode:
// calls return MOCK- ids and the caller gets the event it would have received by webhook,
// so the whole money loop can be developed and demoed before sandbox keys exist.

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

export function paypalMode(): "sandbox" | "mock" {
  return process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET ? "sandbox" : "mock";
}

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message);
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString(
    "base64",
  );
  const res = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new PayPalError("PayPal auth failed", res.status, await res.text());
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

// requestId becomes PayPal-Request-Id, which makes retries of the same call idempotent.
export async function paypalFetch<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: unknown; requestId?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;

  const res = await fetch(`${SANDBOX_BASE}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new PayPalError(`PayPal ${init.method} ${path} failed`, res.status, json);
  return json as T;
}

export function mockId(prefix: string) {
  return `MOCK-${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
