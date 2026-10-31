export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Straight-line distance understates driving distance; 1.3 is a common urban detour factor.
// Good enough for stipends and ETAs without paying for a routing API.
const ROAD_FACTOR = 1.3;
const AVG_CITY_SPEED_KMH = 25;

export function roadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * ROAD_FACTOR;
}

export function driveMinutes(km: number): number {
  return Math.ceil((km / AVG_CITY_SPEED_KMH) * 60);
}
