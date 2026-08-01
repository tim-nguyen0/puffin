import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/button";
import { api } from "../../lib/api";
import "./ros-services.css";

const DEMO_NODE = "/offboard_demo";
const TRANSITIONS = ["configure", "activate", "deactivate", "cleanup", "shutdown"] as const;

export function RosServicesScreen() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const services = useQuery({
    queryKey: ["ros-services"],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/services");
      if (error) throw new Error("Failed to fetch services");
      return data;
    },
  });

  const lifecycle = useQuery({
  queryKey: ["ros-lifecycle", DEMO_NODE],
  queryFn: async () => {
    const { data, error } = await api.GET("/ros/lifecycle/{nodeName}", {
      params: { path: { nodeName: DEMO_NODE } },
    });
    if (error) throw new Error("Failed to fetch lifecycle state");
    return data;
  },
});

  const transition = useMutation({
  mutationFn: async (name: (typeof TRANSITIONS)[number]) => {
    const { data, error } = await api.POST("/ros/lifecycle/{nodeName}/transition", {
      params: { path: { nodeName: DEMO_NODE } },
      body: { transition: name },
    });
    if (error || !data.ok) throw new Error(data?.detail ?? "Transition failed");
    return data;
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ros-lifecycle", DEMO_NODE] }),
  onError: (err) => setActionError(err instanceof Error ? err.message : "Transition failed"),
});

  return (
    <div className="ros-services-screen">
      <h1>ROS Services</h1>

      <section className="ros-services-section">
        <h2>Available Services</h2>
        {services.isLoading ? <p>Loading services…</p> : null}
        {services.isError ? <p className="ros-services-error">Could not reach the API.</p> : null}
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

      <section className="ros-services-section">
        <h2>Offboard Demo Lifecycle</h2>
        {lifecycle.isLoading ? <p>Loading lifecycle state…</p> : null}
        {lifecycle.isError ? <p className="ros-services-error">Could not reach the API.</p> : null}
        {lifecycle.data ? (
          <p className="ros-lifecycle-state">
            Node <strong>{lifecycle.data.node}</strong> is currently{" "}
            <strong>{lifecycle.data.state}</strong>
          </p>
        ) : null}
        <div className="ros-lifecycle-actions">
          {TRANSITIONS.map((name) => (
            <Button
              key={name}
              onClick={() => {
                setActionError(null);
                transition.mutate(name);
              }}
              disabled={transition.isPending}
            >
              {name}
            </Button>
          ))}
        </div>
        {actionError ? (
          <p className="ros-services-error" role="alert">
            {actionError}
          </p>
        ) : null}
      </section>
    </div>
  );
}