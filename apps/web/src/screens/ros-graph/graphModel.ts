import type { components } from "@puffin/api-types";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

export type RosService = components["schemas"]["RosService"];

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

function serviceParts(name: string): { namespace: string; operation: string } {
  const segments = name.split("/").filter(Boolean);
  const operation = segments.at(-1) ?? name;
  const namespace =
    segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "/";

  return { namespace, operation };
}

function interfacePackage(type: string): string {
  return type.split("/")[0] || "unknown";
}

function toneFor(typePackage: string): ServiceTone {
  if (typePackage === "rcl_interfaces") return "cyan";
  if (typePackage === "lifecycle_msgs") return "amber";
  if (typePackage.startsWith("px4") || typePackage.startsWith("puffin")) return "blue";
  return "violet";
}

function pairKey(source: ServiceGraphNode, target: ServiceGraphNode): string {
  return [source.id, target.id].sort().join("::");
}

/**
 * Converts the flat ROS service discovery response into a deterministic graph.
 *
 * ROS 2's service discovery response currently does not expose provider/client
 * edges. Until that is added to the contract, links represent two useful,
 * explainable relationships: services under one provider namespace and
 * services that reuse the same interface package across providers.
 */
export function buildServiceGraph(services: RosService[]): ServiceGraph {
  const nodes = services
    .map((service) => {
      const { namespace, operation } = serviceParts(service.name);
      const typePackage = interfacePackage(service.type);

      return {
        id: service.name,
        name: service.name,
        namespace,
        operation,
        type: service.type,
        typePackage,
        tone: toneFor(typePackage),
      } satisfies ServiceGraphNode;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const links: ServiceGraphLink[] = [];
  const linkedPairs = new Set<string>();

  const addLinks = (
    groups: Map<string, ServiceGraphNode[]>,
    kind: ServiceGraphLink["kind"],
  ) => {
    for (const [group, members] of groups) {
      const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));

      for (let index = 1; index < sortedMembers.length; index += 1) {
        const source = sortedMembers[index - 1];
        const target = sortedMembers[index];
        const key = pairKey(source, target);

        if (linkedPairs.has(key)) continue;
        linkedPairs.add(key);
        links.push({
          id: `${kind}:${group}:${source.id}:${target.id}`,
          source: source.id,
          target: target.id,
          kind,
        });
      }
    }
  };

  const byNamespace = new Map<string, ServiceGraphNode[]>();
  const byInterface = new Map<string, ServiceGraphNode[]>();

  for (const node of nodes) {
    byNamespace.set(node.namespace, [...(byNamespace.get(node.namespace) ?? []), node]);
    byInterface.set(node.typePackage, [
      ...(byInterface.get(node.typePackage) ?? []),
      node,
    ]);
  }

  addLinks(byNamespace, "provider");
  addLinks(byInterface, "interface");

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
