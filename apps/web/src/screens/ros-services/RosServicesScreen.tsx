import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { lifecycleNodeNames } from "../../components/lifecycle";
import { api } from "../../lib/api";
import { NodeCard } from "./NodeCard";
import "./ros-services.css";

export function RosServicesScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const services = useQuery({
    queryKey: ["ros-services"],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/services");
      if (error) throw new Error("Failed to fetch services");
      return data;
    },
    refetchInterval: 5000,
  });

  const nodes = lifecycleNodeNames(services.data ?? []);
  const selectedNode = selected && nodes.includes(selected) ? selected : (nodes[0] ?? null);

  return (
    <div className="ros-services-screen">
      <h1>ROS Nodes</h1>

      <section className="ros-services-section">
        <h2>Lifecycle Nodes</h2>
        {services.isLoading ? <p>Loading nodes…</p> : null}
        {services.isError ? <p className="ros-services-error">Could not reach the API.</p> : null}
        {services.data && nodes.length === 0 ? (
          <p className="ros-services-empty">No lifecycle nodes found.</p>
        ) : null}
        {nodes.length > 0 ? (
          <>
            <label className="ros-node-select">
              Select node
              <select
                value={selectedNode ?? ""}
                onChange={(event) => setSelected(event.target.value)}
              >
                {nodes.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {selectedNode ? <NodeCard nodeName={selectedNode} /> : null}
          </>
        ) : null}
      </section>

      <section className="ros-services-section">
        <h2>Available Services</h2>
        {services.isLoading ? <p>Loading services…</p> : null}
        {services.data && services.data.length === 0 ? (
          <p className="ros-services-empty">No services reported.</p>
        ) : null}
        {services.data && services.data.length > 0 ? (
          <ul className="ros-services-list">
            {services.data.map((svc) => (
              <li key={svc.name}>
                <span>{svc.name}</span>
                <span className="ros-service-type">{svc.type}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
