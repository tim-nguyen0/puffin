import { describe, expect, it } from "vitest";
import {
  TELEOP_SPEED_M_S,
  TELEOP_VERTICAL_M_S,
  teleopFrame,
  teleopWebSocketUrl,
} from "./teleopMessages";

describe("teleop messages", () => {
  it("maps held directions into ned velocities", () => {
    const frame = teleopFrame(new Set(["forward", "left", "up"] as const));
    expect(frame).toEqual({
      vx: TELEOP_SPEED_M_S,
      vy: -TELEOP_SPEED_M_S,
      vz: -TELEOP_VERTICAL_M_S,
      yaw_rate: 0,
    });
  });

  it("opposing holds cancel and empty means hover", () => {
    expect(teleopFrame(new Set(["forward", "back"] as const)).vx).toBe(0);
    expect(teleopFrame(new Set())).toEqual({ vx: 0, vy: 0, vz: 0, yaw_rate: 0 });
  });

  it("builds the websocket url from the page origin", () => {
    expect(teleopWebSocketUrl("http:", "localhost:5173")).toBe("ws://localhost:5173/ws/teleop");
    expect(teleopWebSocketUrl("https:", "puffin.test")).toBe("wss://puffin.test/ws/teleop");
  });
});
