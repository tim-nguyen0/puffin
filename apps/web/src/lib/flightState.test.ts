import type { components } from "@puffin/api-types";
import { describe, expect, it } from "vitest";
import { isAirborne, runGateTitle } from "./flightState";

type TelemetrySample = components["schemas"]["TelemetrySample"];

function sample(overrides: Partial<TelemetrySample> = {}): TelemetrySample {
  return {
    t_us: 1_234_567,
    armed: false,
    mode: "auto_loiter",
    landed: true,
    ned: { x: 0, y: 0, z: 0 },
    battery_v: 15.8,
    attitude_q: [1, 0, 0, 0],
    ...overrides,
  };
}

describe("isAirborne", () => {
  it("is airborne only while the detector says the vehicle is off the ground", () => {
    expect(isAirborne(true, sample({ landed: false }))).toBe(true);
    expect(isAirborne(true, sample({ landed: true }))).toBe(false);
  });

  it("ignores a drifted altitude on a parked vehicle", () => {
    // the reported bug: after a couple of flights the ekf origin has drifted
    // and a landed vehicle reports over a metre up. it is still landed.
    const parked = sample({ landed: true, ned: { x: 0, y: 0, z: -1.33 } });
    expect(isAirborne(true, parked)).toBe(false);
  });

  it("stays airborne at a low altitude the old threshold called grounded", () => {
    const justOff = sample({ landed: false, ned: { x: 0, y: 0, z: -0.2 } });
    expect(isAirborne(true, justOff)).toBe(true);
  });

  it("reads grounded with no telemetry", () => {
    expect(isAirborne(false, null)).toBe(false);
    expect(isAirborne(false, sample({ landed: false }))).toBe(false);
    expect(isAirborne(true, null)).toBe(false);
  });
});

describe("runGateTitle", () => {
  it("explains the gate on the ground and says nothing in the air", () => {
    expect(runGateTitle(false)).toBe("take off first - the vehicle is on the ground");
    expect(runGateTitle(true)).toBeUndefined();
  });
});
