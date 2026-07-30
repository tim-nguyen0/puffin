import { describe, expect, it } from "vitest";
import { buildServiceGraph, matchesGraphFilter } from "./graphModel";

const services = [
  { name: "/camera/get_parameters", type: "rcl_interfaces/srv/GetParameters" },
  { name: "/camera/set_parameters", type: "rcl_interfaces/srv/SetParameters" },
  { name: "/lidar/get_parameters", type: "rcl_interfaces/srv/GetParameters" },
  { name: "/planner/clear_path", type: "puffin_msgs/srv/ClearPath" },
];

describe("buildServiceGraph", () => {
  it("turns ROS services into service nodes and inferred relationships", () => {
    const graph = buildServiceGraph(services);

    expect(graph.nodes).toHaveLength(4);
    expect(graph.nodes[0]).toMatchObject({
      name: "/camera/get_parameters",
      namespace: "/camera",
      operation: "get_parameters",
      typePackage: "rcl_interfaces",
    });
    expect(graph.links.some((link) => link.kind === "provider")).toBe(true);
    expect(graph.links.some((link) => link.kind === "interface")).toBe(true);
  });

  it("does not create duplicate links for overlapping relationships", () => {
    const graph = buildServiceGraph(services.slice(0, 2));

    expect(graph.links).toHaveLength(1);
    expect(graph.links[0].kind).toBe("provider");
  });
});

describe("matchesGraphFilter", () => {
  const node = buildServiceGraph(services).nodes[0];

  it("matches by service name, type, and interface package", () => {
    expect(matchesGraphFilter(node, "camera", "all")).toBe(true);
    expect(matchesGraphFilter(node, "GetParameters", "rcl_interfaces")).toBe(true);
    expect(matchesGraphFilter(node, "camera", "puffin_msgs")).toBe(false);
  });
});
