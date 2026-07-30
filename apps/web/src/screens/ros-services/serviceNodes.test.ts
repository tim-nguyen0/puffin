import { describe, expect, it } from "vitest";
import {
  countServiceStates,
  INITIAL_SERVICE_NODES,
  transitionServiceNode,
} from "./serviceNodes";

describe("service node fixtures", () => {
  it("matches the designed running, armed, and stopped summary", () => {
    expect(countServiceStates(INITIAL_SERVICE_NODES)).toEqual({
      armed: 2,
      running: 3,
      stopped: 2,
    });
  });

  it("updates only the requested node for UI lifecycle actions", () => {
    const updated = transitionServiceNode(
      INITIAL_SERVICE_NODES,
      "vision_landing",
      "arm",
    );

    expect(updated.find((node) => node.name === "vision_landing")?.status).toBe(
      "armed",
    );
    expect(updated.find((node) => node.name === "offboard_control")?.status).toBe(
      "running",
    );
  });
});
