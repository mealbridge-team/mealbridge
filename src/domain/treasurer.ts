import type { Area } from "@/db/schema";

export type PoolBalance = {
  id: string;
  kind: "restaurant" | "donor_area" | "sponsor" | "general";
  area: Area | null;
  restaurantId: string | null;
  availableCents: number;
};

export type Allocation = { poolId: string; amountCents: number };

// Which money pays for a trip, in order: the restaurant's own compliance-plan pool, donors who
// earmarked this area, sponsors (area-specific before citywide), then the general pool.
// All-or-nothing: a trip is either fully funded before dispatch or stays unfunded.
export function allocateTrip(
  stipendCents: number,
  pools: PoolBalance[],
  trip: { restaurantId: string; area: Area },
): { funded: boolean; allocations: Allocation[] } {
  const rank = (p: PoolBalance): number | null => {
    if (p.kind === "restaurant") return p.restaurantId === trip.restaurantId ? 0 : null;
    if (p.kind === "donor_area") return p.area === trip.area ? 1 : null;
    if (p.kind === "sponsor") {
      if (p.area === trip.area) return 2;
      return p.area === null ? 3 : null;
    }
    return 4;
  };

  const eligible = pools
    .map((p) => ({ pool: p, rank: rank(p) }))
    .filter((e): e is { pool: PoolBalance; rank: number } => e.rank !== null && e.pool.availableCents > 0)
    .sort((a, b) => a.rank - b.rank);

  let remaining = stipendCents;
  const allocations: Allocation[] = [];
  for (const { pool } of eligible) {
    if (remaining === 0) break;
    const take = Math.min(remaining, pool.availableCents);
    allocations.push({ poolId: pool.id, amountCents: take });
    remaining -= take;
  }

  if (remaining > 0) return { funded: false, allocations: [] };
  return { funded: true, allocations };
}
