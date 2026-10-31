// Drivers are volunteers; the stipend reimburses fuel and vehicle costs per trip,
// so it scales with distance and is capped rather than paying for time.
export const STIPEND = {
  baseCents: 200,
  perKmCents: 40,
  capCents: 1500,
} as const;

export function stipendCents(distanceKm: number): number {
  const raw = STIPEND.baseCents + Math.round(distanceKm * STIPEND.perKmCents);
  return Math.min(raw, STIPEND.capCents);
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function centsToPaypalValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function paypalValueToCents(value: string): number {
  return Math.round(Number.parseFloat(value) * 100);
}
