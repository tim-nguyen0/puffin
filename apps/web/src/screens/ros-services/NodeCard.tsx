import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/button";
import { api } from "../../lib/api";

const TRANSITIONS = ["configure", "activate", "deactivate", "cleanup", "shutdown"] as const;

// the ros 2 lifecycle state machine; unknown states leave everything
// enabled and let the api answer
const VALID_TRANSITIONS: Record<string, readonly (typeof TRANSITIONS)[number][]> = {
  unconfigured: ["configure", "shutdown"],
  inactive: ["activate", "cleanup", "shutdown"],
  active: ["deactivate", "shutdown"],
  finalized: [],
};

export type NodeCardProps = {
  nodeName: string;
};

export function NodeCard({ nodeName }: NodeCardProps) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  // the api treats the name as one path segment - no leading slash
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
    mutationFn: async (name: (typeof TRANSITIONS)[number]) => {
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
    <article className="node-card" aria-label={`${nodeName} lifecycle`}>
      <header className="node-card-header">
        <span className="node-card-name">{nodeName}</span>
        <span className={`node-card-state node-card-state-${state ?? "unknown"}`}>
          {lifecycle.isError ? "unreachable" : (state ?? "…")}
        </span>
      </header>
      <div className="node-card-actions">
        {TRANSITIONS.map((name) => {
          const allowed = state ? (VALID_TRANSITIONS[state]?.includes(name) ?? true) : true;
          return (
            <Button
              key={name}
              onClick={() => {
                setActionError(null);
                transition.mutate(name);
              }}
              disabled={transition.isPending || !allowed}
              title={allowed ? undefined : `not valid from ${state}`}
            >
              {name}
            </Button>
          );
        })}
      </div>
      {actionError ? (
        <p className="ros-services-error" role="alert">
          {actionError}
        </p>
      ) : null}
    </article>
  );
}
