import type { components } from "@puffin/api-types";
import { describe, expect, it } from "vitest";
import {
  actionsForState,
  forgedNodeMeta,
  metaForNode,
  replayTarget,
  toneForState,
  transitionForAction,
} from "./serviceNodes";

type ProcessInfo = components["schemas"]["ProcessInfo"];

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

describe("replayTarget", () => {
  const procs = (state: ProcessInfo["state"]): ProcessInfo[] => [
    { name: "px4", state: "RUNNING", uptime_s: 9 },
    { name: "patrol_demo", state, uptime_s: 0 },
  ];

  it("offers a replay for a one-shot that finished its flight", () => {
    expect(replayTarget("/patrol_demo", true, procs("EXITED"))).toEqual({
      program: "patrol_demo",
      completed: true,
    });
  });

  it("offers a replay for a program stopped some other way, without calling it done", () => {
    expect(replayTarget("/patrol_demo", true, procs("FATAL"))).toEqual({
      program: "patrol_demo",
      completed: false,
    });
  });

  it("stays out of the way while the node is still answering", () => {
    expect(replayTarget("/patrol_demo", false, procs("EXITED"))).toBeNull();
  });

  it("does not offer a replay for a process that is up or coming up", () => {
    expect(replayTarget("/patrol_demo", true, procs("RUNNING"))).toBeNull();
    expect(replayTarget("/patrol_demo", true, procs("STARTING"))).toBeNull();
  });

  it("has no handle for a node with no supervised program of its name", () => {
    // the node names /offboard_demo, the program names offboard-demo - a
    // near-miss must not be treated as a match
    expect(replayTarget("/offboard_demo", true, [
      { name: "offboard-demo", state: "EXITED", uptime_s: 0 },
    ])).toBeNull();
  });
});
