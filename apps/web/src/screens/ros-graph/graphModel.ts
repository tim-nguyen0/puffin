import type { components } from "@puffin/api-types";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

export type RosGraphData = components["schemas"]["RosGraph"];

export type ServiceTone = "cyan" | "blue" | "amber" | "violet";

export interface ServiceGraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  namespace: string;
  operation: string;
  type: string;
  typePackage: string;
  tone: ServiceTone;
}

export interface ServiceGraphLink extends SimulationLinkDatum<ServiceGraphNode> {
  id: string;
  source: string | ServiceGraphNode;
  target: string | ServiceGraphNode;
  kind: "provider" | "interface";
}

export interface ServiceGraph {
  nodes: ServiceGraphNode[];
  links: ServiceGraphLink[];
}

function nameParts(name: string): { namespace: string; operation: string } {
  const segments = name.split("/").filter(Boolean);
  const operation = segments.at(-1) ?? name;
  const namespace =
    segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "/";

  return { namespace, operation };
}

function interfacePackage(type: string): string {
  return type.split("/")[0] || "unknown";
}

function topicTone(typePackage: string): ServiceTone {
  if (typePackage.startsWith("px4")) return "blue";
  if (typePackage === "rcl_interfaces") return "amber";
  return "violet";
}

// chatter every node has; rqt hides these by default too
export const SYSTEM_TOPICS = new Set(["/parameter_events", "/rosout"]);

// the api's own introspection node - infrastructure, not part of the ros
// system the graph is meant to show
export const INFRA_NODES = new Set(["/puffin_api"]);

// rqt's "ros system only" view: drop system topics, infra nodes, and
// their edges before the graph is built
export function filterRosOnly(graph: RosGraphData): RosGraphData {
  return {
    nodes: graph.nodes.filter((name) => !INFRA_NODES.has(name)),
    topics: graph.topics
      .filter((topic) => !SYSTEM_TOPICS.has(topic.name))
      .map((topic) => ({
        ...topic,
        publishers: topic.publishers.filter((name) => !INFRA_NODES.has(name)),
        subscribers: topic.subscribers.filter((name) => !INFRA_NODES.has(name)),
      })),
  };
}

/**
 * Builds the computation graph from /ros/graph: ros nodes (cyan) and
 * topics (toned by message package), joined by real pub/sub edges -
 * publisher links render as "provider", subscriber links as "interface".
 */
export function buildServiceGraph(graph: RosGraphData): ServiceGraph {
  const nodes: ServiceGraphNode[] = [];
  const byId = new Map<string, ServiceGraphNode>();

  const addNode = (node: ServiceGraphNode) => {
    if (byId.has(node.id)) return;
    byId.set(node.id, node);
    nodes.push(node);
  };

  const addRosNode = (name: string) => {
    const { namespace, operation } = nameParts(name);
    addNode({
      id: name,
      name,
      namespace,
      operation,
      type: "ros2 node",
      typePackage: "node",
      tone: "cyan",
    });
  };

  for (const name of graph.nodes) addRosNode(name);

  for (const topic of graph.topics) {
    const { namespace, operation } = nameParts(topic.name);
    const typePackage = interfacePackage(topic.type);
    addNode({
      id: topic.name,
      name: topic.name,
      namespace,
      operation,
      type: topic.type,
      typePackage,
      tone: topicTone(typePackage),
    });
    // edges may reference participants the node list misses (bare dds
    // apps) - add them so no link dangles
    for (const endpoint of [...topic.publishers, ...topic.subscribers]) {
      addRosNode(endpoint);
    }
  }

  nodes.sort((a, b) => a.name.localeCompare(b.name));

  const links: ServiceGraphLink[] = [];
  for (const topic of graph.topics) {
    for (const publisher of topic.publishers) {
      links.push({
        id: `pub:${publisher}:${topic.name}`,
        source: publisher,
        target: topic.name,
        kind: "provider",
      });
    }
    for (const subscriber of topic.subscribers) {
      links.push({
        id: `sub:${topic.name}:${subscriber}`,
        source: topic.name,
        target: subscriber,
        kind: "interface",
      });
    }
  }

  return { nodes, links };
}

export function matchesGraphFilter(
  node: ServiceGraphNode,
  search: string,
  typePackage: string,
): boolean {
  const normalizedSearch = search.trim().toLowerCase();
  const matchesSearch =
    normalizedSearch.length === 0 ||
    node.name.toLowerCase().includes(normalizedSearch) ||
    node.type.toLowerCase().includes(normalizedSearch);
  const matchesPackage = typePackage === "all" || node.typePackage === typePackage;

  return matchesSearch && matchesPackage;
}
