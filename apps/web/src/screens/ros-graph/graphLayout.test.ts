import { describe, expect, it } from "vitest";
import { INFRA_NODES, layoutGraph, SYSTEM_TOPICS } from "./graphLayout";

const GRAPH = {
  nodes: ["/puffin_api", "/offboard_demo"],
  topics: [
    {
      name: "/fmu/in/trajectory_setpoint",
      type: "px4_msgs/msg/TrajectorySetpoint",
      publishers: ["/offboard_demo"],
      subscribers: ["/px4_xrce_agent"],
    },
    {
      name: "/fmu/out/vehicle_status_v1",
      type: "px4_msgs/msg/VehicleStatus",
      publishers: ["/px4_xrce_agent"],
      subscribers: ["/puffin_api"],
    },
    {
      name: "/parameter_events",
      type: "rcl_interfaces/msg/ParameterEvent",
      publishers: ["/puffin_api"],
      subscribers: [],
    },
  ],
};

describe("graph layout", () => {
  it("puts nodes left of topics", () => {
    const layout = layoutGraph(GRAPH, false);
    const nodes = layout.boxes.filter((b) => b.kind === "node");
    const topics = layout.boxes.filter((b) => b.kind === "topic");
    const rightmostNode = Math.max(...nodes.map((b) => b.x + b.width));
    const leftmostTopic = Math.min(...topics.map((b) => b.x));
    expect(rightmostNode).toBeLessThan(leftmostTopic);
  });

  it("draws pub and sub edges for a topic", () => {
    const layout = layoutGraph(GRAPH, false);
    const kinds = layout.edges.map((e) => e.kind);
    expect(kinds).toContain("pub");
    expect(kinds).toContain("sub");
  });

  it("adds boxes for participants missing from the node list", () => {
    const layout = layoutGraph(GRAPH, false);
    expect(layout.boxes.some((b) => b.id === "/px4_xrce_agent" && b.kind === "node")).toBe(true);
  });

  it("hides system topics in ros-only mode", () => {
    const layout = layoutGraph(GRAPH, true);
    for (const name of SYSTEM_TOPICS) {
      expect(layout.boxes.some((b) => b.id === name)).toBe(false);
    }
    expect(layout.boxes.some((b) => b.id === "/fmu/in/trajectory_setpoint")).toBe(true);
  });

  it("hides the api node and its edges in ros-only mode", () => {
    const layout = layoutGraph(GRAPH, true);
    for (const name of INFRA_NODES) {
      expect(layout.boxes.some((b) => b.id === name)).toBe(false);
      expect(layout.edges.some((e) => e.id.includes(name))).toBe(false);
    }
  });

  it("shows the api node when ros-only is off", () => {
    const layout = layoutGraph(GRAPH, false);
    expect(layout.boxes.some((b) => b.id === "/puffin_api")).toBe(true);
  });

  it("survives an empty graph", () => {
    const layout = layoutGraph({ nodes: [], topics: [] }, true);
    expect(layout.boxes).toEqual([]);
    expect(layout.edges).toEqual([]);
  });
});
