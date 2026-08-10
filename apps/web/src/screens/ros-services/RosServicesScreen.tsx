import type { components } from "@puffin/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/button";
import {
  actionsForState,
  forgedNodeMeta,
  lifecycleNodeNames,
  metaForNode,
  replayTarget,
  toneForState,
  transitionForAction,
  type LifecycleStateName,
  type ServiceNodeAction,
  type ServiceNodeMeta,
} from "../../components/lifecycle";
import { StatusIndicator } from "../../components/status-indicator";
import { StatusTag } from "../../components/status-tag";
import { api } from "../../lib/api";
import "./ros-services.css";

type ProcessInfo = components["schemas"]["ProcessInfo"];

const ACTION_LABELS: Record<ServiceNodeAction, string> = {
  arm: "Arm",
  run: "Run",
  stop: "Stop",
};

function useNodeState(nodeName: string) {
  const pathName = nodeName.replace(/^\//, "");
  return useQuery({
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
}

// metaForNode's generic fallback is the only shape with an em-dash package -
// known nodes always name a real one
function isGenericMeta(meta: ServiceNodeMeta): boolean {
  return meta.package === "—";
}

// forged-ness doesn't change while the screen is open, so this fetches once
// and never polls; only asked for nodes metaForNode can't already explain
function useForgeStatus(nodeName: string, enabled: boolean) {
  const pathName = nodeName.replace(/^\//, "");
  return useQuery({
    queryKey: ["mission-forge-status", pathName],
    queryFn: async () => {
      const { data, error } = await api.GET("/mission/forge/{name}", {
        params: { path: { name: pathName } },
      });
      if (error) throw new Error("Failed to fetch forge status");
      return data;
    },
    enabled,
    staleTime: Infinity,
  });
}

// known metadata wins; otherwise a forge that reports "done" explains the
// node for real, and anything else keeps the generic lifecycle description
function useNodeMeta(nodeName: string): { meta: ServiceNodeMeta; isForged: boolean } {
  const knownMeta = metaForNode(nodeName);
  const forge = useForgeStatus(nodeName, isGenericMeta(knownMeta));
  const isForged = forge.data?.state === "done";
  return { meta: isForged ? forgedNodeMeta(nodeName) : knownMeta, isForged };
}

// supervisord's roster, so a node that has exited can still be started again
// from here - see replayTarget for why the process outlives the node
function useProcesses() {
  return useQuery({
    queryKey: ["procs"],
    queryFn: async () => {
      const { data, error } = await api.GET("/procs");
      if (error) throw new Error("Failed to fetch processes");
      return data;
    },
    refetchInterval: 5000,
  });
}

function useReplay(onDone: (message: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (program: string) => {
      const { data, error } = await api.POST("/procs/{name}/start", {
        params: { path: { name: program } },
      });
      if (error || !data.ok) throw new Error(data?.detail ?? "Replay failed");
      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["procs"] });
      void queryClient.invalidateQueries({ queryKey: ["ros-services"] });
      void queryClient.invalidateQueries({ queryKey: ["ros-lifecycle"] });
      onDone(data.detail);
    },
    onError: (err) => onDone(err instanceof Error ? err.message : "Replay failed"),
  });
}

function useTransition(onDone: (message: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nodeName: string; transition: string }) => {
      const { data, error } = await api.POST("/ros/lifecycle/{nodeName}/transition", {
        params: { path: { nodeName: input.nodeName.replace(/^\//, "") } },
        body: {
          transition: input.transition as
            | "configure"
            | "activate"
            | "deactivate"
            | "cleanup"
            | "shutdown",
        },
      });
      if (error || !data.ok) throw new Error(data?.detail ?? "Transition failed");
      return data;
    },
    onSuccess: (data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["ros-lifecycle", input.nodeName.replace(/^\//, "")],
      });
      onDone(data.detail ?? `${input.nodeName}: ${input.transition} accepted`);
    },
    onError: (err) =>
      onDone(err instanceof Error ? err.message : "Transition failed"),
  });
}

interface ServiceNodeRowProps {
  isSelected: boolean;
  nodeName: string;
  onAction: (action: ServiceNodeAction, state: LifecycleStateName | undefined) => void;
  onReplay: (program: string) => void;
  onSelect: () => void;
  onState: (name: string, state: LifecycleStateName | undefined) => void;
  processes: readonly ProcessInfo[];
  replayPending: boolean;
}

function ServiceNodeRow({
  isSelected,
  nodeName,
  onAction,
  onReplay,
  onSelect,
  onState,
  processes,
  replayPending,
}: ServiceNodeRowProps) {
  const lifecycle = useNodeState(nodeName);
  const state = lifecycle.data?.state as LifecycleStateName | undefined;
  const tone = toneForState(state);
  const { meta } = useNodeMeta(nodeName);
  // a one-shot that finished leaves an unknown node and a stopped program
  const stopped = replayTarget(nodeName, lifecycle.isError || state === "unknown", processes);

  useEffect(() => {
    onState(nodeName, state);
  }, [nodeName, state, onState]);

  return (
    <li className={`service-node-row${isSelected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="service-node-select"
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <span className={`service-node-dot service-node-dot-${tone}`} />
        <span className="service-node-copy">
          <strong>{nodeName}</strong>
          <small>{meta.description}</small>
        </span>
      </button>

      <div className="service-node-controls">
        <StatusTag
          status={tone}
          label={stopped ? (stopped.completed ? "completed" : "stopped") : (state ?? "…")}
        />
        {stopped ? (
          <Button
            className="service-action-button service-action-replay"
            aria-label={`Replay ${nodeName}`}
            disabled={replayPending}
            onClick={() => onReplay(stopped.program)}
          >
            Replay
          </Button>
        ) : (
          actionsForState(state).map((action) => (
            <Button
              key={action}
              className={`service-action-button service-action-${action}`}
              aria-label={`${ACTION_LABELS[action]} ${nodeName}`}
              onClick={() => onAction(action, state)}
            >
              {ACTION_LABELS[action]}
            </Button>
          ))
        )}
      </div>
    </li>
  );
}

interface LifecycleStepProps {
  detail: string;
  isCurrent: boolean;
  label: string;
  status: "armed" | "running" | "stopped";
}

function LifecycleStep({ detail, isCurrent, label, status }: LifecycleStepProps) {
  return (
    <div className="lifecycle-step">
      <span className={`lifecycle-state-dot lifecycle-state-dot-${status}`} />
      <strong>{label}</strong>
      <span>{detail}</span>
      {isCurrent ? <StatusTag label="current" showDot={false} status={status} /> : null}
    </div>
  );
}

interface NodeInspectorProps {
  nodeName: string;
  onAction: (action: ServiceNodeAction, state: LifecycleStateName | undefined) => void;
}

function NodeInspector({ nodeName, onAction }: NodeInspectorProps) {
  const lifecycle = useNodeState(nodeName);
  const state = lifecycle.data?.state as LifecycleStateName | undefined;
  const tone = toneForState(state);
  const { meta, isForged } = useNodeMeta(nodeName);
  const legal = actionsForState(state);

  return (
    <aside className="node-inspector" aria-label="Selected node details">
      <header className="node-inspector-header">
        <span>Selected node</span>
        <div className="node-inspector-title-row">
          <h2>{nodeName}</h2>
          {isForged ? (
            <span className="node-inspector-forged-tag">
              <StatusTag label="forged" showDot={false} status="stopped" />
            </span>
          ) : null}
        </div>
        <p>{meta.description}</p>
      </header>

      <section className="node-inspector-section">
        <h3>Lifecycle state</h3>
        <div className="lifecycle-flow">
          <LifecycleStep
            label="Stopped"
            detail="unconfigured"
            status="stopped"
            isCurrent={tone === "stopped"}
          />
          <p aria-hidden="true">↓ lifecycle set → configure</p>
          <LifecycleStep
            label="Armed"
            detail="inactive (configured)"
            status="armed"
            isCurrent={tone === "armed"}
          />
          <p aria-hidden="true">↓ lifecycle set → activate</p>
          <LifecycleStep
            label="Running"
            detail="active"
            status="running"
            isCurrent={tone === "running"}
          />
        </div>
      </section>

      <section className="node-inspector-section">
        <h3>Details</h3>
        <dl className="node-detail-list">
          <div>
            <dt>Package</dt>
            <dd>{meta.package}</dd>
          </div>
          <div>
            <dt>Executable</dt>
            <dd>{meta.executable}</dd>
          </div>
          <div>
            <dt>Publishes</dt>
            <dd>{meta.publishes}</dd>
          </div>
          <div>
            <dt>Subscribes</dt>
            <dd>{meta.subscribes}</dd>
          </div>
        </dl>

        <h3 className="launch-command-title">Launch command</h3>
        <div className="launch-command" aria-label="Launch commands">
          <code>
            {meta.package !== "—" ? (
              <span>
                <b>$</b> ros2 run {meta.package} {meta.executable}
              </span>
            ) : null}
            <span>
              <b>$</b> ros2 lifecycle set {nodeName} activate
            </span>
          </code>
        </div>
      </section>

      <div className="node-inspector-actions">
        {(["arm", "run", "stop"] as const).map((action) => (
          <Button
            key={action}
            className={`inspector-action-button inspector-action-${action}`}
            disabled={!legal.includes(action)}
            onClick={() => onAction(action, state)}
          >
            {ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
    </aside>
  );
}

export function RosServicesScreen() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // rows report their live states up so the footer can count them
  const [states, setStates] = useState<Record<string, LifecycleStateName | undefined>>({});

  const services = useQuery({
    queryKey: ["ros-services"],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/services");
      if (error) throw new Error("Failed to fetch services");
      return data;
    },
    refetchInterval: 5000,
  });

  const transition = useTransition(setAnnouncement);
  const processes = useProcesses();
  const replay = useReplay(setAnnouncement);

  const nodes = lifecycleNodeNames(services.data ?? []);
  const selectedNode = selected && nodes.includes(selected) ? selected : (nodes[0] ?? null);

  const recordState = useCallback(
    (name: string, state: LifecycleStateName | undefined) => {
      setStates((current) =>
        current[name] === state ? current : { ...current, [name]: state },
      );
    },
    [],
  );

  const handleAction = (
    nodeName: string,
    action: ServiceNodeAction,
    state: LifecycleStateName | undefined,
  ) => {
    const name = transitionForAction(action, state);
    if (!name) return;
    setSelected(nodeName);
    transition.mutate({ nodeName, transition: name });
  };

  const tones = nodes.map((name) => toneForState(states[name]));
  const counts = {
    running: tones.filter((tone) => tone === "running").length,
    armed: tones.filter((tone) => tone === "armed").length,
    stopped: tones.filter((tone) => tone === "stopped").length,
  };

  return (
    <section className="ros-services-screen">
      <div className="services-layout">
        <section className="nodes-panel" aria-labelledby="nodes-panel-title">
          <header className="nodes-panel-header">
            <div>
              <h1 id="nodes-panel-title">Nodes &amp; Launch</h1>
              <p>lifecycle nodes discovered from /ros/services</p>
            </div>
            <Button
              className="node-list-refresh"
              startIcon={<span aria-hidden="true">↻</span>}
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ["ros-services"] });
                void queryClient.invalidateQueries({ queryKey: ["ros-lifecycle"] });
                setAnnouncement("ROS 2 node list refreshed.");
              }}
            >
              ros2 node list
            </Button>
          </header>

          {services.isLoading ? <p className="services-empty">Loading nodes…</p> : null}
          {services.isError ? (
            <p className="services-empty">Could not reach the API.</p>
          ) : null}
          {services.data && nodes.length === 0 ? (
            <p className="services-empty">No lifecycle nodes found.</p>
          ) : null}
          <ul className="service-node-list">
            {nodes.map((name) => (
              <ServiceNodeRow
                key={name}
                nodeName={name}
                isSelected={name === selectedNode}
                onSelect={() => setSelected(name)}
                onAction={(action, state) => handleAction(name, action, state)}
                onReplay={(program) => {
                  setSelected(name);
                  replay.mutate(program);
                }}
                onState={recordState}
                processes={processes.data ?? []}
                replayPending={replay.isPending}
              />
            ))}
          </ul>
        </section>

        {selectedNode ? (
          <NodeInspector
            nodeName={selectedNode}
            onAction={(action, state) => handleAction(selectedNode, action, state)}
          />
        ) : null}
      </div>

      <footer className="services-status-bar">
        {/* the counts speak puffin's vocabulary while the row chips print the
            raw lifecycle state - the titles bridge the two */}
        <div className="services-status-counts">
          <span title="lifecycle state: active">
            Running: <strong>{counts.running}</strong>
          </span>
          <span title="lifecycle state: inactive (configured)">
            Armed: <strong>{counts.armed}</strong>
          </span>
          <span title="lifecycle state: unconfigured or unknown">
            Stopped: <strong>{counts.stopped}</strong>
          </span>
          <span>
            Nodes: <strong>{nodes.length}</strong>
          </span>
        </div>
        <StatusIndicator
          label={
            services.isError
              ? "ROS2 Discovery: Unreachable"
              : "ROS2 Discovery: Connected"
          }
          active={!services.isError}
        />
      </footer>

      <p className="services-announcement" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
