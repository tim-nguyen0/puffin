import type { components } from "@puffin/api-types";

type RosGraph = components["schemas"]["RosGraph"];

// rqt convention: ellipses for nodes (left column), rectangles for topics
// (right column). edges flow node -> topic (publish) and topic -> node
// (subscribe); direction comes from the arrowhead.
const ROW_H = 56;
const BOX_H = 34;
const CHAR_W = 7.4;
const PAD_X = 16;
const MARGIN = 16;
const COLUMN_GAP = 140;

// chatter every node has; rqt hides these by default too
export const SYSTEM_TOPICS = new Set(["/parameter_events", "/rosout"]);

// the api's own introspection node - infrastructure, not part of the ros
// system the graph is meant to show
export const INFRA_NODES = new Set(["/puffin_api"]);

export interface GraphBox {
  id: string;
  label: string;
  kind: "node" | "topic";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphEdge {
  id: string;
  kind: "pub" | "sub";
  path: string;
}

export interface GraphLayout {
  boxes: GraphBox[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

function boxWidth(label: string): number {
  return Math.ceil(label.length * CHAR_W) + PAD_X * 2;
}

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const bend = (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
}

export function layoutGraph(graph: RosGraph, rosOnly: boolean): GraphLayout {
  const showsNode = (name: string) => !rosOnly || !INFRA_NODES.has(name);
  const topics = graph.topics
    .filter((topic) => !rosOnly || !SYSTEM_TOPICS.has(topic.name))
    .map((topic) => ({
      ...topic,
      publishers: topic.publishers.filter(showsNode),
      subscribers: topic.subscribers.filter(showsNode),
    }));

  // edges may reference participants missing from the node list (bare dds
  // apps) - draw them as nodes anyway so no edge dangles
  const nodeIds = graph.nodes.filter(showsNode);
  for (const topic of topics) {
    for (const name of [...topic.publishers, ...topic.subscribers]) {
      if (!nodeIds.includes(name)) nodeIds.push(name);
    }
  }

  const nodeColWidth = Math.max(0, ...nodeIds.map(boxWidth));
  const topicX = MARGIN + nodeColWidth + COLUMN_GAP;

  const boxes: GraphBox[] = [];
  const byId = new Map<string, GraphBox>();
  nodeIds.forEach((id, row) => {
    const width = boxWidth(id);
    const box: GraphBox = {
      id,
      label: id,
      kind: "node",
      // right-align the ellipse column so every edge gap is equal
      x: MARGIN + nodeColWidth - width,
      y: MARGIN + row * ROW_H,
      width,
      height: BOX_H,
    };
    boxes.push(box);
    byId.set(id, box);
  });
  topics.forEach((topic, row) => {
    const box: GraphBox = {
      id: topic.name,
      label: topic.name,
      kind: "topic",
      x: topicX,
      y: MARGIN + row * ROW_H,
      width: boxWidth(topic.name),
      height: BOX_H,
    };
    boxes.push(box);
    byId.set(topic.name, box);
  });

  const edges: GraphEdge[] = [];
  for (const topic of topics) {
    const topicBox = byId.get(topic.name);
    if (!topicBox) continue;
    const topicPort = { x: topicBox.x, y: topicBox.y + topicBox.height / 2 };
    for (const name of topic.publishers) {
      const nodeBox = byId.get(name);
      if (!nodeBox) continue;
      const nodePort = { x: nodeBox.x + nodeBox.width, y: nodeBox.y + nodeBox.height / 2 };
      edges.push({ id: `${name}->${topic.name}`, kind: "pub", path: edgePath(nodePort, topicPort) });
    }
    for (const name of topic.subscribers) {
      const nodeBox = byId.get(name);
      if (!nodeBox) continue;
      const nodePort = { x: nodeBox.x + nodeBox.width, y: nodeBox.y + nodeBox.height / 2 };
      edges.push({ id: `${topic.name}->${name}`, kind: "sub", path: edgePath(topicPort, nodePort) });
    }
  }

  const topicColWidth = Math.max(0, ...topics.map((topic) => boxWidth(topic.name)));
  const rows = Math.max(nodeIds.length, topics.length);
  return {
    boxes,
    edges,
    width: topicX + topicColWidth + MARGIN,
    height: MARGIN * 2 + (rows === 0 ? 0 : (rows - 1) * ROW_H + BOX_H),
  };
}
