import { describe, expect, it } from "vitest";
import {
  actionsForState,
  forgedNodeMeta,
  metaForNode,
  toneForState,
  transitionForAction,
} from "./serviceNodes";

describe("service node mapping", () => {
  it("maps lifecycle states onto the design's tones", () => {
    expect(toneForState("active")).toBe("running");
    expect(toneForState("inactive")).toBe("armed");
    expect(toneForState("unconfigured")).toBe("stopped");
    expect(toneForState("finalized")).toBe("stopped");
    expect(toneForState(undefined)).toBe("stopped");
  });

  it("offers only legal actions per state", () => {
    expect(actionsForState("unconfigured")).toEqual(["arm"]);
    expect(actionsForState("inactive")).toEqual(["run", "stop"]);
    expect(actionsForState("active")).toEqual(["stop"]);
    expect(actionsForState("unknown")).toEqual([]);
  });

  it("resolves each action to one legal transition", () => {
    expect(transitionForAction("arm", "unconfigured")).toBe("configure");
    expect(transitionForAction("run", "inactive")).toBe("activate");
    expect(transitionForAction("stop", "active")).toBe("deactivate");
    expect(transitionForAction("stop", "inactive")).toBe("cleanup");
    expect(transitionForAction("run", "active")).toBeNull();
  });

  it("knows the shipped nodes and degrades for strangers", () => {
    expect(metaForNode("/offboard_demo").package).toBe("offboard_demo");
    expect(metaForNode("/teleop").executable).toBe("teleop_node");
    expect(metaForNode("/mystery").package).toBe("—");
  });

  it("gives forged nodes real metadata keyed off their own name", () => {
    const meta = forgedNodeMeta("/patrol_demo");
    expect(meta.package).toBe("patrol_demo");
    expect(meta.executable).toBe("patrol_demo");
    expect(meta.publishes).toBe("/puffin/mission/status");
    expect(meta.subscribes).toBe("—");
    expect(meta.description).toContain("forged");
  });

  it("does not mutate metaForNode's fallback for known or unknown nodes", () => {
    expect(metaForNode("/offboard_demo")).toEqual({
      description: "lifecycle node · 10 m square via offboard setpoints",
      package: "offboard_demo",
      executable: "offboard_demo_node",
      publishes: "/fmu/in/trajectory_setpoint",
      subscribes: "/fmu/out/vehicle_local_position",
    });
    expect(metaForNode("/mystery")).toEqual({
      description: "ros 2 lifecycle node",
      package: "—",
      executable: "—",
      publishes: "—",
      subscribes: "—",
    });
  });
});
