import { localMinutes } from "@/domain/matcher";

const EVENING_START = 17 * 60;
const EVENING_END = 22 * 60;
const DEMO_HOUR = 19 * 60;

// Shelters keep evening hours in California, but judges try the public demo at any hour from
// anywhere. Unless DEMO_EVENING=off, the opening-hours check runs on a "demo evening" clock: the
// real time moved into the 7pm hour, Pacific. Only opening hours use it; food-safety windows and
// every timestamp stay real. The UI labels it whenever it's in effect.
export function demoEveningShiftMs(now: Date): number {
  if (process.env.DEMO_EVENING === "off") return 0;
  const minutes = localMinutes(now);
  if (minutes >= EVENING_START && minutes < EVENING_END) return 0;
  return (DEMO_HOUR + (minutes % 60) - minutes) * 60_000;
}

export function demoEveningActive(now = new Date()) {
  return demoEveningShiftMs(now) !== 0;
}

const TONIGHT_MS = 14 * 3_600_000;

// "Tonight" on every screen: the last 14 hours, so an evening's rescues stay together past midnight.
export function isTonight(date: Date, now = Date.now()) {
  return now - date.getTime() < TONIGHT_MS;
}

export function daysAgo(days: number, now = Date.now()) {
  return new Date(now - days * 86_400_000);
}
