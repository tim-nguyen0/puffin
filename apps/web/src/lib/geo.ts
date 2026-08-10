// small pure helpers so the sensor cards can answer with real numbers

// mirrors <spherical_coordinates> in sim/worlds/puffin.sdf
export const WORLD_ORIGIN = { lat: 47.397971, lon: 8.546164 };

const EARTH_RADIUS_M = 6371000;
const DEG = 180 / Math.PI;

export interface EulerDeg {
  roll: number;
  pitch: number;
  yaw: number;
}

// px4 attitude [w, x, y, z], body FRD -> NED, to aerospace euler degrees
export function quatToEulerDeg(q: [number, number, number, number]): EulerDeg {
  const [w, x, y, z] = q;
  const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const sinPitch = Math.max(-1, Math.min(1, 2 * (w * y - z * x)));
  const pitch = Math.asin(sinPitch);
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  return { roll: roll * DEG + 0, pitch: pitch * DEG + 0, yaw: yaw * DEG + 0 };
}

// flat-earth offset from the world origin; fine at sim scale (meters, not km)
export function nedToLatLon(north: number, east: number): { lat: number; lon: number } {
  const lat = WORLD_ORIGIN.lat + (north / EARTH_RADIUS_M) * DEG;
  const lon =
    WORLD_ORIGIN.lon +
    (east / (EARTH_RADIUS_M * Math.cos(WORLD_ORIGIN.lat / DEG))) * DEG;
  return { lat, lon };
}

// climb rate from the last two samples; ned z is down, so climb = -dz/dt
export function climbRate(
  samples: Array<{ t_us: number; ned: { z: number } }>,
): number {
  if (samples.length < 2) return 0;
  const a = samples[samples.length - 2];
  const b = samples[samples.length - 1];
  const dt = (b.t_us - a.t_us) / 1e6;
  if (dt <= 0) return 0;
  return (a.ned.z - b.ned.z) / dt + 0;
}
