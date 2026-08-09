import { describe, expect, it } from "vitest";
import {
  flightTimeS,
  formatDuration,
  maxAltitudeM,
  missionPath,
  preflightChecks,
  rowTone,
  totalDistance,
} from "./missionMath";

const square = [
  { x: 10, y: 0, z: -5, hold_s: 0 },
  { x: 10, y: 10, z: -5, hold_s: 0 },
  { x: 0, y: 10, z: -5, hold_s: 0 },
  { x: 0, y: 0, z: -5, hold_s: 0 },
];

describe("mission path and stats", () => {
  it("climbs first and returns when asked", () => {
    const path = missionPath(square, -3, true);
    expect(path[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(path[1]).toEqual({ x: 0, y: 0, z: -3 });
    expect(path[path.length - 1]).toEqual({ x: 0, y: 0, z: -3 });
  });

  it("sums the flown legs", () => {
    // climb 5 + four 10 m sides, no return leg needed (ends at start xy)
    const noReturn = totalDistance(square, -5, false);
    expect(noReturn).toBeCloseTo(45, 5);
  });

  it("adds holds to the time estimate", () => {
    const held = square.map((wp) => ({ ...wp, hold_s: 5 }));
    expect(flightTimeS(held, -5, false) - flightTimeS(square, -5, false)).toBeCloseTo(20, 5);
  });

  it("reports altitude as height, not ned z", () => {
    expect(maxAltitudeM(square, -3)).toBe(5);
    expect(maxAltitudeM([], -3)).toBe(3);
  });

  it("formats durations for humans", () => {
    expect(formatDuration(200)).toBe("3min 20s");
    expect(formatDuration(42)).toBe("42s");
  });
});

describe("row tones from executor status", () => {
  const flying = { state: "flying" as const, current_index: 1, total: 4, detail: "" };

  it("walks reached/active/pending around the current index", () => {
    expect(rowTone(0, flying)).toBe("reached");
    expect(rowTone(1, flying)).toBe("active");
    expect(rowTone(2, flying)).toBe("pending");
  });

  it("stays pending while climbing out", () => {
    expect(rowTone(0, { ...flying, current_index: null })).toBe("pending");
  });

  it("marks everything reached once done", () => {
    expect(rowTone(3, { ...flying, state: "done", current_index: null })).toBe("reached");
  });
});

describe("preflight", () => {
  it("flags underground z instead of letting the executor refuse later", () => {
    const checks = preflightChecks(
      [{ x: 1, y: 1, z: 2, hold_s: 0 }],
      -3,
      true,
      "inactive",
      "/mission",
    );
    expect(checks.find((c) => c.label === "altitudes")?.ok).toBe(false);
  });

  it("passes a sane plan", () => {
    const checks = preflightChecks(square, -3, true, "inactive", "/mission");
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("flags a missing node selection instead of a stale executor state", () => {
    const checks = preflightChecks(square, -3, true, undefined, null);
    const executor = checks.find((c) => c.label === "executor");
    expect(executor?.ok).toBe(false);
    expect(executor?.detail).toBe("no node selected in the control panel");
  });
});
