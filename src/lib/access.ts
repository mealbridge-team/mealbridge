import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// The public demo has no accounts, so coordinator powers (approving payouts, cancelling trips,
// resetting the demo) sit behind one shared passcode from DEMO_PASSCODE, listed in the README for
// judges. Without DEMO_PASSCODE (local development) everything is open.

const COOKIE = "mb_coordinator";

export function passcodeRequired() {
  return Boolean(process.env.DEMO_PASSCODE);
}

function expectedToken() {
  return createHmac("sha256", process.env.DEMO_PASSCODE ?? "").update("coordinator-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function isCoordinator() {
  if (!passcodeRequired()) return true;
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? safeEqual(token, expectedToken()) : false;
}

export async function requireCoordinator() {
  if (!(await isCoordinator())) throw new Error("Enter the coordinator passcode first.");
}

export async function unlockCoordinator(passcode: string) {
  if (!passcodeRequired() || !safeEqual(passcode.trim(), process.env.DEMO_PASSCODE!)) return false;
  (await cookies()).set(COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return true;
}
