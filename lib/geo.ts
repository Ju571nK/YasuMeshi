const EARTH_RADIUS_M = 6_371_000;
const WALK_SPEED_M_PER_MIN = 80;

/** Haversine distance in meters between two coordinates */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Approximate walk time in minutes (straight-line distance / 80m per min) */
export function walkMinutes(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const distance = haversineDistance(lat1, lng1, lat2, lng2);
  return Math.round(distance / WALK_SPEED_M_PER_MIN);
}
