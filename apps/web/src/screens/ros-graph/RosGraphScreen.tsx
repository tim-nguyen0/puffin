import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import { layoutGraph } from "./graphLayout";
import "./ros-graph.css";

export function RosGraphScreen() {
  const [hideSystemTopics, setHideSystemTopics] = useState(true);

  const graph = useQuery({
    queryKey: ["ros-graph"],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/graph");
      if (error) throw new Error("Failed to fetch graph");
      return data;
    },
    refetchInterval: 5000,
  });

  const layout = graph.data ? layoutGraph(graph.data, hideSystemTopics) : null;

  return (
    <div className="ros-graph-screen">
      <h1>ROS Graph</h1>

      <section className="ros-graph-section">
        <div className="ros-graph-toolbar">
          <label className="ros-graph-toggle">
            <input
              type="checkbox"
              checked={hideSystemTopics}
              onChange={(e) => setHideSystemTopics(e.target.checked)}
            />
            Hide system topics
          </label>
          <span className="ros-graph-legend">
            <span className="ros-graph-legend-swatch ros-graph-legend-pub" /> publish
            <span className="ros-graph-legend-swatch ros-graph-legend-sub" /> subscribe
          </span>
        </div>

        {graph.isLoading ? <p>Loading graph…</p> : null}
        {graph.isError ? <p className="ros-graph-error">Could not reach the API.</p> : null}
        {layout && layout.boxes.length === 0 ? (
          <p className="ros-graph-empty">No nodes or topics reported.</p>
        ) : null}
        {layout && layout.boxes.length > 0 ? (
          <div className="ros-graph-canvas">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              width={layout.width}
              role="img"
              aria-label="ROS computation graph"
            >
              <defs>
                <marker
                  id="ros-graph-arrow-pub"
                  className="ros-graph-arrow-pub"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
                <marker
                  id="ros-graph-arrow-sub"
                  className="ros-graph-arrow-sub"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
              </defs>
              {layout.edges.map((edge) => (
                <path
                  key={edge.id}
                  d={edge.path}
                  className={`ros-graph-edge ros-graph-edge-${edge.kind}`}
                  markerEnd={`url(#ros-graph-arrow-${edge.kind})`}
                />
              ))}
              {layout.boxes.map((box) =>
                box.kind === "node" ? (
                  <g key={box.id}>
                    <ellipse
                      className="ros-graph-node"
                      cx={box.x + box.width / 2}
                      cy={box.y + box.height / 2}
                      rx={box.width / 2}
                      ry={box.height / 2}
                    />
                    <text
                      className="ros-graph-label"
                      x={box.x + box.width / 2}
                      y={box.y + box.height / 2}
                    >
                      {box.label}
                    </text>
                  </g>
                ) : (
                  <g key={box.id}>
                    <rect
                      className="ros-graph-topic"
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                    />
                    <text
                      className="ros-graph-label"
                      x={box.x + box.width / 2}
                      y={box.y + box.height / 2}
                    >
                      {box.label}
                    </text>
                  </g>
                ),
              )}
            </svg>
          </div>
        ) : null}
      </section>
    </div>
  );
}
