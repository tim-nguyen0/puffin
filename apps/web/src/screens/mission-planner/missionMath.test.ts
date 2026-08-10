import { describe, expect, it } from "vitest";
import {
  flightStatus,
  flightTimeS,
  formatDuration,
  maxAltitudeM,
  missionPath,
  plansMatch,
  preflightChecks,
  rowTone,
  totalDistance,
  type FlightPlan,
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
    const checks = preflightChecks([{ x: 1, y: 1, z: 2, hold_s: 0 }], -3, true, "inactive");
    expect(checks.find((c) => c.label === "altitudes")?.ok).toBe(false);
  });

  it("passes a sane plan once mission_planner is reachable", () => {
    const checks = preflightChecks(square, -3, true, "inactive");
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("treats a never-primed (unconfigured) executor as ok, same as inactive", () => {
    const checks = preflightChecks(square, -3, true, "unconfigured");
    expect(checks.find((c) => c.label === "executor")?.ok).toBe(true);
  });

  it("flags mission_planner by name when it can't be reached", () => {
    const checks = preflightChecks(square, -3, true, undefined);
    const executor = checks.find((c) => c.label === "executor");
    expect(executor?.ok).toBe(false);
    expect(executor?.detail).toBe("mission_planner not reachable");
  });
});

describe("flightStatus", () => {
  it("reads active as flying, running tone", () => {
    expect(flightStatus("active")).toEqual({ label: "flying", tone: "running" });
  });

  it("reads inactive and unconfigured both as ready, armed tone", () => {
    expect(flightStatus("inactive")).toEqual({ label: "ready", tone: "armed" });
    expect(flightStatus("unconfigured")).toEqual({ label: "ready", tone: "armed" });
  });

  it("reads unknown/finalized/undefined as offline, stopped tone", () => {
    expect(flightStatus("unknown")).toEqual({ label: "offline", tone: "stopped" });
    expect(flightStatus("finalized")).toEqual({ label: "offline", tone: "stopped" });
    expect(flightStatus(undefined)).toEqual({ label: "offline", tone: "stopped" });
  });
});

describe("plansMatch", () => {
  const base: FlightPlan = { waypoints: square, rateHz: 20, takeoffZ: -3, returnToOrigin: true };

  it("matches an identical plan by value, not by reference", () => {
    const clone: FlightPlan = { ...base, waypoints: square.map((wp) => ({ ...wp })) };
    expect(plansMatch(base, clone)).toBe(true);
  });

  it("flags a moved waypoint", () => {
    const edited: FlightPlan = {
      ...base,
      waypoints: base.waypoints.map((wp, i) => (i === 0 ? { ...wp, x: wp.x + 1 } : wp)),
    };
    expect(plansMatch(base, edited)).toBe(false);
  });

  it("flags a changed setting even with the same waypoints", () => {
    expect(plansMatch(base, { ...base, rateHz: 30 })).toBe(false);
    expect(plansMatch(base, { ...base, takeoffZ: -5 })).toBe(false);
    expect(plansMatch(base, { ...base, returnToOrigin: false })).toBe(false);
  });

  it("flags an added or removed waypoint", () => {
    expect(plansMatch(base, { ...base, waypoints: [...base.waypoints, base.waypoints[0]] })).toBe(false);
  });
});
