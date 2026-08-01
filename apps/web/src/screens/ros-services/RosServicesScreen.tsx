import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { NodeCard } from "./NodeCard";
import { lifecycleNodeNames } from "./lifecycleNodes";
import "./ros-services.css";

export function RosServicesScreen() {
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

  return (
    <div className="ros-services-screen">
      <h1>ROS Services</h1>

      <section className="ros-services-section">
        <h2>Lifecycle Nodes</h2>
        {services.isLoading ? <p>Loading nodes…</p> : null}
        {services.isError ? <p className="ros-services-error">Could not reach the API.</p> : null}
        {services.data && nodes.length === 0 ? (
          <p className="ros-services-empty">No lifecycle nodes found.</p>
        ) : null}
        {nodes.length > 0 ? (
          <div className="node-card-grid">
            {nodes.map((name) => (
              <NodeCard key={name} nodeName={name} />
            ))}
          </div>
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
