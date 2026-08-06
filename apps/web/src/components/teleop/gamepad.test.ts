import { describe, expect, it } from "vitest";
import { applyDeadzone, frameIsActive, gamepadFrame } from "./gamepad";
import { TELEOP_SPEED_M_S, TELEOP_VERTICAL_M_S } from "./teleopMessages";

describe("gamepad mapping", () => {
  it("centered sticks command hover", () => {
    const frame = gamepadFrame([0, 0, 0, 0]);
    expect(frame).toEqual({ vx: 0, vy: 0, vz: 0, yaw_rate: 0 });
    expect(frameIsActive(frame)).toBe(false);
  });

  it("stick drift inside the deadzone stays zero", () => {
    expect(applyDeadzone(0.08)).toBe(0);
    expect(frameIsActive(gamepadFrame([0.05, -0.1, 0.08, -0.04]))).toBe(false);
  });

  it("rescales smoothly outside the deadzone", () => {
    expect(applyDeadzone(1)).toBeCloseTo(1);
    expect(applyDeadzone(-1)).toBeCloseTo(-1);
    expect(applyDeadzone(0.12)).toBeCloseTo(0);
  });

  it("right stick up flies north, right flies east", () => {
    const frame = gamepadFrame([0, 0, 1, -1]);
    expect(frame.vx).toBeCloseTo(TELEOP_SPEED_M_S);
    expect(frame.vy).toBeCloseTo(TELEOP_SPEED_M_S);
  });

  it("left stick up climbs (negative ned z) and left yaws left", () => {
    const frame = gamepadFrame([-1, -1, 0, 0]);
    expect(frame.vz).toBeCloseTo(-TELEOP_VERTICAL_M_S);
    expect(frame.yaw_rate).toBeLessThan(0);
  });
});
