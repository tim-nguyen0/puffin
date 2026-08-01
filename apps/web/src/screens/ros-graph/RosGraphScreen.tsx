import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import "./ros-graph.css";

export function RosGraphScreen() {
  const graph = useQuery({
    queryKey: ["ros-graph"],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/graph");
      if (error) throw new Error("Failed to fetch graph");
      return data;
    },
  });

  return (
    <div className="ros-graph-screen">
      <h1>ROS Graph</h1>

      <section className="ros-graph-section">
        <h2>Nodes</h2>
        {graph.isLoading ? <p>Loading graph…</p> : null}
        {graph.isError ? <p className="ros-graph-error">Could not reach the API.</p> : null}
        {graph.data && graph.data.nodes.length === 0 ? (
          <p className="ros-graph-empty">No nodes reported.</p>
        ) : null}
        {graph.data && graph.data.nodes.length > 0 ? (
          <ul className="ros-graph-list">
            {graph.data.nodes.map((node) => (
              <li key={node}>
                <span>{node}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="ros-graph-section">
        <h2>Topics</h2>
        {graph.data && graph.data.topics.length === 0 ? (
          <p className="ros-graph-empty">No topics reported.</p>
        ) : null}
        {graph.data && graph.data.topics.length > 0 ? (
          <ul className="ros-graph-list">
            {graph.data.topics.map((topic) => (
              <li key={topic.name}>
                <span>{topic.name}</span>
                <span className="ros-topic-type">{topic.type}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}