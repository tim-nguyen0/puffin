import { describe, expect, it } from "vitest";
import { climbRate, nedToLatLon, quatToEulerDeg, WORLD_ORIGIN } from "./sensorMath";

describe("quaternion to euler", () => {
  it("maps identity to level flight", () => {
    expect(quatToEulerDeg([1, 0, 0, 0])).toEqual({ roll: 0, pitch: 0, yaw: 0 });
  });

  it("recovers a pure 90 degree yaw", () => {
    const s = Math.SQRT1_2;
    const { roll, pitch, yaw } = quatToEulerDeg([s, 0, 0, s]);
    expect(roll).toBeCloseTo(0, 5);
    expect(pitch).toBeCloseTo(0, 5);
    expect(yaw).toBeCloseTo(90, 5);
  });

  it("recovers a pure roll", () => {
    const s = Math.SQRT1_2;
    expect(quatToEulerDeg([s, s, 0, 0]).roll).toBeCloseTo(90, 5);
  });
});

describe("ned to lat/lon", () => {
  it("stays at the world origin with no offset", () => {
    expect(nedToLatLon(0, 0)).toEqual({ lat: WORLD_ORIGIN.lat, lon: WORLD_ORIGIN.lon });
  });

  it("moves ~one milli-degree per 111 m north", () => {
    const { lat } = nedToLatLon(111.19, 0);
    expect(lat - WORLD_ORIGIN.lat).toBeCloseTo(0.001, 4);
  });

  it("scales east offset by the origin latitude", () => {
    const { lon } = nedToLatLon(0, 111.19);
    expect(lon - WORLD_ORIGIN.lon).toBeGreaterThan(0.001);
  });
});

describe("climb rate", () => {
  it("reads climb as negative ned z change", () => {
    const rate = climbRate([
      { t_us: 0, ned: { z: -1 } },
      { t_us: 500_000, ned: { z: -2 } },
    ]);
    expect(rate).toBeCloseTo(2, 5);
  });

  it("returns zero without enough history", () => {
    expect(climbRate([{ t_us: 0, ned: { z: 0 } }])).toBe(0);
  });
});
