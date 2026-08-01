import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import { lifecycleNodeNames } from "./lifecycleNodes";
import "./lifecycle-quick-panel.css";

// compact activate/kill controls; the full state machine lives on the
// ros nodes screen. kill = lifecycle shutdown - supervisord respawns the
// node fresh, so it comes back inactive.
export function LifecycleQuickPanel() {
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

  if (services.isError) {
    return <p className="lifecycle-quick-error">Could not reach the API.</p>;
  }
  if (nodes.length === 0) {
    return <p className="lifecycle-quick-empty">No lifecycle nodes found.</p>;
  }
  return (
    <ul className="lifecycle-quick-list">
      {nodes.map((name) => (
        <QuickRow key={name} nodeName={name} />
      ))}
    </ul>
  );
}

function QuickRow({ nodeName }: { nodeName: string }) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const pathName = nodeName.replace(/^\//, "");

  const lifecycle = useQuery({
    queryKey: ["ros-lifecycle", pathName],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/lifecycle/{nodeName}", {
        params: { path: { nodeName: pathName } },
      });
      if (error) throw new Error("Failed to fetch lifecycle state");
      return data;
    },
    refetchInterval: 5000,
  });

  const transition = useMutation({
    mutationFn: async (name: "activate" | "shutdown") => {
      const { data, error } = await api.POST("/ros/lifecycle/{nodeName}/transition", {
        params: { path: { nodeName: pathName } },
        body: { transition: name },
      });
      if (error || !data.ok) throw new Error(data?.detail ?? "Transition failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ros-lifecycle", pathName] }),
    onError: (err) => setActionError(err instanceof Error ? err.message : "Transition failed"),
  });

  const state = lifecycle.data?.state;

  return (
    <li className="lifecycle-quick-row">
      <span className="lifecycle-quick-name">{nodeName}</span>
      <span className={`lifecycle-quick-state lifecycle-quick-state-${state ?? "unknown"}`}>
        {lifecycle.isError ? "unreachable" : (state ?? "…")}
      </span>
      <span className="lifecycle-quick-actions">
        <button
          type="button"
          className="lifecycle-quick-button"
          onClick={() => {
            setActionError(null);
            transition.mutate("activate");
          }}
          disabled={transition.isPending || state !== "inactive"}
          title={state === "inactive" ? undefined : `not valid from ${state ?? "unknown"}`}
        >
          Activate
        </button>
        <button
          type="button"
          className="lifecycle-quick-button lifecycle-quick-kill"
          onClick={() => {
            setActionError(null);
            transition.mutate("shutdown");
          }}
          disabled={transition.isPending || state === "finalized" || !state}
        >
          Kill
        </button>
      </span>
      {actionError ? (
        <span className="lifecycle-quick-error" role="alert">
          {actionError}
        </span>
      ) : null}
    </li>
  );
}
