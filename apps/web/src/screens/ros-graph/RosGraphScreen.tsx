import { useQuery } from "@tanstack/react-query";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
} from "d3-force";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  GraphFilterBar,
  type GraphLayout,
  type GraphVisibility,
} from "../../components/graph-filter";
import { api } from "../../lib/api";
import {
  buildServiceGraph,
  matchesGraphFilter,
  type RosService,
  type ServiceGraph,
  type ServiceGraphLink,
  type ServiceGraphNode,
} from "./graphModel";
import "./ros-graph.css";

const GRAPH_REFRESH_INTERVAL_MS = 10_000;
const NODE_WIDTH = 224;
const NODE_HEIGHT = 72;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.2;

type ViewTransform = { x: number; y: number; scale: number };
type GraphSize = { width: number; height: number };

type DragState =
  | { kind: "canvas"; pointerId: number; clientX: number; clientY: number }
  | { kind: "node"; pointerId: number; node: ServiceGraphNode };

async function fetchRosServices(): Promise<RosService[]> {
  const { data, error } = await api.GET("/ros/services");

  if (error) throw new Error("ROS 2 service discovery is unavailable.");
  return data;
}

function endpointNode(
  endpoint: string | ServiceGraphNode,
  nodes: ServiceGraphNode[],
): ServiceGraphNode | undefined {
  return typeof endpoint === "string"
    ? nodes.find((node) => node.id === endpoint)
    : endpoint;
}

function createHierarchicalNodes(
  sourceNodes: ServiceGraphNode[],
  size: GraphSize,
): ServiceGraphNode[] {
  const groups = new Map<string, ServiceGraphNode[]>();

  for (const node of sourceNodes) {
    groups.set(node.namespace, [...(groups.get(node.namespace) ?? []), node]);
  }

  const orderedGroups = [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const orderedNodes = orderedGroups.flatMap(([, members]) =>
    [...members].sort((left, right) => left.name.localeCompare(right.name)),
  );
  const maximumColumns = Math.max(1, Math.floor(size.width / (NODE_WIDTH + 72)));
  const columns = Math.max(
    1,
    Math.min(maximumColumns, Math.ceil(Math.sqrt(orderedNodes.length))),
  );
  const rows = Math.max(1, Math.ceil(orderedNodes.length / columns));
  const cellWidth = size.width / columns;
  const cellHeight = size.height / rows;

  return orderedNodes.map((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      ...node,
      x: cellWidth * (column + 0.5),
      y: cellHeight * (row + 0.5),
    };
  });
}

function GraphSkeleton() {
  return (
    <div className="graph-skeleton" aria-label="Discovering ROS 2 services">
      <span className="graph-skeleton-node graph-skeleton-node-a" />
      <span className="graph-skeleton-node graph-skeleton-node-b" />
      <span className="graph-skeleton-node graph-skeleton-node-c" />
      <span className="graph-skeleton-line graph-skeleton-line-a" />
      <span className="graph-skeleton-line graph-skeleton-line-b" />
      <p>Discovering ROS 2 services…</p>
    </div>
  );
}

interface ServiceGraphViewportProps {
  graph: ServiceGraph;
  search: string;
  layout: GraphLayout;
  selectedId: string | null;
  onSelect: (node: ServiceGraphNode) => void;
}

function ServiceGraphViewport({
  graph,
  search,
  layout,
  selectedId,
  onSelect,
}: ServiceGraphViewportProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const simulationRef =
    useRef<Simulation<ServiceGraphNode, ServiceGraphLink> | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [size, setSize] = useState<GraphSize>({ width: 960, height: 640 });
  const [nodes, setNodes] = useState<ServiceGraphNode[]>([]);
  const [links, setLinks] = useState<ServiceGraphLink[]>([]);
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(entry.contentRect.width, 320),
        height: Math.max(entry.contentRect.height, 460),
      });
    });

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setView({ x: 0, y: 0, scale: 1 });
  }, [layout]);

  useEffect(() => {
    const simulationLinks = graph.links.map((link) => ({ ...link }));

    if (layout === "hierarchical") {
      setNodes(createHierarchicalNodes(graph.nodes, size));
      setLinks(simulationLinks);
      simulationRef.current = null;
      return;
    }

    const simulationNodes = graph.nodes.map((node, index) => {
      const angle = (index / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
      const orbit = Math.min(size.width, size.height) * 0.28;

      return {
        ...node,
        x: size.width / 2 + Math.cos(angle) * orbit,
        y: size.height / 2 + Math.sin(angle) * orbit,
      };
    });

    const simulation = forceSimulation<ServiceGraphNode>(simulationNodes)
      .force(
        "link",
        forceLink<ServiceGraphNode, ServiceGraphLink>(simulationLinks)
          .id((node) => node.id)
          .distance((link) => (link.kind === "provider" ? 150 : 260))
          .strength((link) => (link.kind === "provider" ? 0.8 : 0.24)),
      )
      .force("charge", forceManyBody().strength(-900))
      .force("center", forceCenter(size.width / 2, size.height / 2))
      .force("collision", forceCollide<ServiceGraphNode>().radius(NODE_WIDTH * 0.66))
      .alphaDecay(0.035);

    const render = () => {
      for (const node of simulationNodes) {
        node.x = Math.min(
          size.width - NODE_WIDTH / 2,
          Math.max(NODE_WIDTH / 2, node.x ?? size.width / 2),
        );
        node.y = Math.min(
          size.height - NODE_HEIGHT,
          Math.max(NODE_HEIGHT, node.y ?? size.height / 2),
        );
      }
      setNodes([...simulationNodes]);
      setLinks([...simulationLinks]);
    };

    simulation.on("tick", render);
    simulationRef.current = simulation;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      simulation.stop();
      simulation.tick(180);
      render();
    }

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [graph, layout, size.height, size.width]);

  const graphPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = size.width / rect.width;
    const scaleY = size.height / rect.height;

    return {
      x: ((event.clientX - rect.left) * scaleX - view.x) / view.scale,
      y: ((event.clientY - rect.top) * scaleY - view.y) / view.scale,
    };
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      kind: "canvas",
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  };

  const handleNodePointerDown = (
    event: ReactPointerEvent<SVGGElement>,
    node: ServiceGraphNode,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    node.fx = node.x;
    node.fy = node.y;
    dragRef.current = { kind: "node", pointerId: event.pointerId, node };
    simulationRef.current?.alphaTarget(0.2).restart();
    onSelect(node);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.kind === "node") {
      const point = graphPoint(event);
      drag.node.x = point.x;
      drag.node.y = point.y;
      drag.node.fx = point.x;
      drag.node.fy = point.y;
      setNodes((current) => [...current]);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = size.width / rect.width;
    const scaleY = size.height / rect.height;
    const deltaX = (event.clientX - drag.clientX) * scaleX;
    const deltaY = (event.clientY - drag.clientY) * scaleY;

    setView((current) => ({
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    }));
    dragRef.current = {
      ...drag,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.kind === "node") {
      drag.node.fx = null;
      drag.node.fy = null;
      simulationRef.current?.alphaTarget(0);
    }
    dragRef.current = null;
  };

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = ((event.clientX - rect.left) / rect.width) * size.width;
    const cursorY = ((event.clientY - rect.top) / rect.height) * size.height;
    const direction = event.deltaY < 0 ? 1.12 : 1 / 1.12;

    setView((current) => {
      const nextScale = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, current.scale * direction),
      );
      const graphX = (cursorX - current.x) / current.scale;
      const graphY = (cursorY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: cursorX - graphX * nextScale,
        y: cursorY - graphY * nextScale,
      };
    });
  };

  const zoomFromCenter = (direction: "in" | "out") => {
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    const factor = direction === "in" ? 1.2 : 1 / 1.2;

    setView((current) => {
      const nextScale = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, current.scale * factor),
      );
      const graphX = (centerX - current.x) / current.scale;
      const graphY = (centerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: centerX - graphX * nextScale,
        y: centerY - graphY * nextScale,
      };
    });
  };

  return (
    <div className="graph-viewport" ref={frameRef}>
      <svg
        className="service-graph"
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`${layout === "hierarchical" ? "Hierarchical" : "Force-directed"} graph of ${nodes.length} ROS 2 services`}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern
            id="graph-grid"
            className="graph-grid-pattern"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" />
          </pattern>
        </defs>
        <rect className="graph-hit-area" width="100%" height="100%" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <g className="graph-links">
            {links.map((link) => {
              const source = endpointNode(link.source, nodes);
              const target = endpointNode(link.target, nodes);
              if (!source || !target) return null;

              const isDimmed =
                !matchesGraphFilter(source, search, "all") ||
                !matchesGraphFilter(target, search, "all");

              return (
                <line
                  key={link.id}
                  className={`graph-link graph-link-${link.kind}${
                    isDimmed ? " is-dimmed" : ""
                  }`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                />
              );
            })}
          </g>
          <g className="graph-nodes">
            {nodes.map((node) => {
              const isSelected = selectedId === node.id;
              const isDimmed = !matchesGraphFilter(node, search, "all");

              return (
                <g
                  key={node.id}
                  className={`service-node service-node-${node.tone}${
                    isSelected ? " is-selected" : ""
                  }${isDimmed ? " is-dimmed" : ""}`}
                  transform={`translate(${node.x ?? 0} ${node.y ?? 0})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.name}, ${node.type}`}
                  aria-pressed={isSelected}
                  onPointerDown={(event) => handleNodePointerDown(event, node)}
                  onClick={() => onSelect(node)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(node);
                    }
                  }}
                >
                  <rect
                    x={-NODE_WIDTH / 2}
                    y={-NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="12"
                  />
                  <circle
                    className="service-node-status"
                    cx={-NODE_WIDTH / 2 + 20}
                    cy={-NODE_HEIGHT / 2 + 20}
                    r="4"
                  />
                  <text className="service-node-operation" x="0" y="-3">
                    /{node.operation}
                  </text>
                  <text className="service-node-namespace" x="0" y="20">
                    {node.namespace}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="graph-legend graph-legend-overlay" aria-label="Graph relationships">
        <span>
          <i className="legend-line-provider" />
          Same provider
        </span>
        <span>
          <i className="legend-line-interface" />
          Shared interface
        </span>
      </div>

      <div className="graph-zoom-controls" aria-label="Graph zoom controls">
        <button type="button" aria-label="Zoom in" onClick={() => zoomFromCenter("in")}>
          +
        </button>
        <button
          type="button"
          aria-label="Reset graph view"
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
        >
          {Math.round(view.scale * 100)}%
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomFromCenter("out")}>
          −
        </button>
      </div>

      <p className="graph-gesture-hint">Drag to move · Scroll to zoom · Select to inspect</p>
    </div>
  );
}

interface ServiceInspectorProps {
  selected: ServiceGraphNode | null;
  related: ServiceGraphNode[];
  onSelect: (node: ServiceGraphNode) => void;
}

function ServiceInspector({ selected, related, onSelect }: ServiceInspectorProps) {
  return (
    <aside className="service-inspector" aria-label="Selected service details">
      <div className="inspector-header">
        <span className="inspector-kicker">Inspector</span>
        <span className="inspector-status">
          <span aria-hidden="true" />
          Discovered
        </span>
      </div>

      {selected ? (
        <>
          <div className={`inspector-symbol service-node-${selected.tone}`} aria-hidden="true">
            S
          </div>
          <h2>{selected.operation}</h2>
          <p className="inspector-service-name">{selected.name}</p>

          <dl className="inspector-metadata">
            <div>
              <dt>Provider namespace</dt>
              <dd>{selected.namespace}</dd>
            </div>
            <div>
              <dt>Interface</dt>
              <dd>{selected.type}</dd>
            </div>
            <div>
              <dt>Relationship</dt>
              <dd>Inferred from discovery</dd>
            </div>
          </dl>

          <div className="related-services">
            <h3>Related services</h3>
            {related.length > 0 ? (
              <ul>
                {related.map((node) => (
                  <li key={node.id}>
                    <button type="button" onClick={() => onSelect(node)}>
                      <span>{node.operation}</span>
                      <small>{node.namespace}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No inferred relationships.</p>
            )}
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <span aria-hidden="true">◎</span>
          <h2>Select a service</h2>
          <p>Choose a node to inspect its provider namespace and interface type.</p>
        </div>
      )}
    </aside>
  );
}

export function RosGraphScreen() {
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<GraphVisibility>("active");
  const [layout, setLayout] = useState<GraphLayout>("hierarchical");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isError, isFetching, isPending, refetch } = useQuery({
    queryKey: ["ros-services"],
    queryFn: fetchRosServices,
    refetchInterval: GRAPH_REFRESH_INTERVAL_MS,
  });

  const graph = useMemo(() => buildServiceGraph(data ?? []), [data]);
  const namespaces = useMemo(
    () => new Set(graph.nodes.map((node) => node.namespace)).size,
    [graph.nodes],
  );
  const typePackages = useMemo(
    () => [...new Set(graph.nodes.map((node) => node.typePackage))].sort(),
    [graph.nodes],
  );
  const selected =
    graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0] ?? null;
  const related = selected
    ? graph.links
        .filter((link) => {
          const sourceId = typeof link.source === "string" ? link.source : link.source.id;
          const targetId = typeof link.target === "string" ? link.target : link.target.id;
          return sourceId === selected.id || targetId === selected.id;
        })
        .map((link) => {
          const source = endpointNode(link.source, graph.nodes);
          const target = endpointNode(link.target, graph.nodes);
          return source?.id === selected.id ? target : source;
        })
        .filter((node): node is ServiceGraphNode => Boolean(node))
    : [];

  return (
    <section className="ros-graph-screen">
      <header className="ros-graph-header">
        <div>
          <p className="screen-eyebrow">ROS 2 / Discovery</p>
          <h1>Service topology</h1>
          <p className="screen-description">
            Explore discovered service endpoints, provider groups, and shared interfaces.
          </p>
        </div>
        <div className="graph-health" aria-live="polite">
          <span className={isFetching ? "is-refreshing" : ""} aria-hidden="true" />
          {isFetching ? "Refreshing graph" : "Discovery online"}
        </div>
      </header>

      <div className="graph-stat-row" aria-label="ROS 2 graph summary">
        <div className="graph-stat">
          <span>Services</span>
          <strong>{graph.nodes.length}</strong>
        </div>
        <div className="graph-stat">
          <span>Namespaces</span>
          <strong>{namespaces}</strong>
        </div>
        <div className="graph-stat">
          <span>Interfaces</span>
          <strong>{typePackages.length}</strong>
        </div>
        <div className="graph-stat graph-stat-wide">
          <span>Source</span>
          <strong>Live ROS discovery</strong>
        </div>
      </div>

      <GraphFilterBar
        visibility={visibility}
        onVisibilityChange={setVisibility}
        search={search}
        onSearchChange={setSearch}
        layout={layout}
        onLayoutChange={setLayout}
        isRefreshing={isFetching}
        onRefresh={() => void refetch()}
      />

      <div className="graph-workspace">
        <div className="graph-content">
          {isPending ? <GraphSkeleton /> : null}
          {isError ? (
            <div className="graph-message" role="alert">
              <span aria-hidden="true">!</span>
              <h2>Discovery is unavailable</h2>
              <p>Start the ROS bridge or try the service query again.</p>
              <button type="button" onClick={() => void refetch()}>
                Try again
              </button>
            </div>
          ) : null}
          {!isPending && !isError && graph.nodes.length === 0 ? (
            <div className="graph-message">
              <span aria-hidden="true">◎</span>
              <h2>No services discovered</h2>
              <p>The graph will populate as ROS 2 service endpoints appear.</p>
              <button type="button" onClick={() => void refetch()}>
                Scan again
              </button>
            </div>
          ) : null}
          {!isPending && !isError && graph.nodes.length > 0 ? (
            <>
              <ServiceGraphViewport
                graph={graph}
                search={search}
                layout={layout}
                selectedId={selected?.id ?? null}
                onSelect={(node) => setSelectedId(node.id)}
              />
              <ServiceInspector
                selected={selected}
                related={related}
                onSelect={(node) => setSelectedId(node.id)}
              />
            </>
          ) : null}
        </div>
      </div>

      <p className="graph-method-note">
        Relationships are inferred from service namespaces and interface packages until
        provider/client edges are exposed by ROS discovery.
      </p>
    </section>
  );
}
