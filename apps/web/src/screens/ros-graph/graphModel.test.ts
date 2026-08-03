import { describe, expect, it } from "vitest";
import {
  buildServiceGraph,
  filterRosOnly,
  INFRA_NODES,
  matchesGraphFilter,
  SYSTEM_TOPICS,
} from "./graphModel";

const GRAPH = {
  nodes: ["/offboard_demo", "/puffin_api"],
  topics: [
    {
      name: "/fmu/in/trajectory_setpoint",
      type: "px4_msgs/msg/TrajectorySetpoint",
      publishers: ["/offboard_demo"],
      subscribers: ["/px4_xrce_agent"],
    },
  ],
};

describe("buildServiceGraph", () => {
  it("builds nodes for ros nodes, topics, and edge-only participants", () => {
    const graph = buildServiceGraph(GRAPH);
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toContain("/offboard_demo");
    expect(ids).toContain("/fmu/in/trajectory_setpoint");
    expect(ids).toContain("/px4_xrce_agent");
  });

  it("links publishers into topics and topics into subscribers", () => {
    const graph = buildServiceGraph(GRAPH);
    expect(graph.links).toContainEqual(
      expect.objectContaining({
        source: "/offboard_demo",
        target: "/fmu/in/trajectory_setpoint",
        kind: "provider",
      }),
    );
    expect(graph.links).toContainEqual(
      expect.objectContaining({
        source: "/fmu/in/trajectory_setpoint",
        target: "/px4_xrce_agent",
        kind: "interface",
      }),
    );
  });

  it("tones topics by message package and ros nodes cyan", () => {
    const graph = buildServiceGraph(GRAPH);
    const topic = graph.nodes.find((node) => node.id === "/fmu/in/trajectory_setpoint");
    const rosNode = graph.nodes.find((node) => node.id === "/offboard_demo");
    expect(topic?.tone).toBe("blue");
    expect(rosNode?.tone).toBe("cyan");
  });

  it("filters by search text and type package", () => {
    const graph = buildServiceGraph(GRAPH);
    const topic = graph.nodes.find((node) => node.id === "/fmu/in/trajectory_setpoint");
    expect(matchesGraphFilter(topic!, "trajectory", "all")).toBe(true);
    expect(matchesGraphFilter(topic!, "nope", "all")).toBe(false);
    expect(matchesGraphFilter(topic!, "", "px4_msgs")).toBe(true);
    expect(matchesGraphFilter(topic!, "", "node")).toBe(false);
  });
});

describe("filterRosOnly", () => {
  const RAW = {
    nodes: ["/offboard_demo", "/puffin_api"],
    topics: [
      {
        name: "/parameter_events",
        type: "rcl_interfaces/msg/ParameterEvent",
        publishers: ["/puffin_api"],
        subscribers: [],
      },
      {
        name: "/fmu/out/vehicle_status",
        type: "px4_msgs/msg/VehicleStatus",
        publishers: ["/px4_xrce_agent"],
        subscribers: ["/puffin_api", "/offboard_demo"],
      },
    ],
  };

  it("drops infra nodes, system topics, and their edges", () => {
    const filtered = filterRosOnly(RAW);
    for (const name of INFRA_NODES) expect(filtered.nodes).not.toContain(name);
    for (const name of SYSTEM_TOPICS) {
      expect(filtered.topics.map((t) => t.name)).not.toContain(name);
    }
    expect(filtered.topics[0].subscribers).toEqual(["/offboard_demo"]);
  });

  it("keeps the ros system intact", () => {
    const filtered = filterRosOnly(RAW);
    expect(filtered.nodes).toContain("/offboard_demo");
    expect(filtered.topics[0].publishers).toEqual(["/px4_xrce_agent"]);
  });
});
