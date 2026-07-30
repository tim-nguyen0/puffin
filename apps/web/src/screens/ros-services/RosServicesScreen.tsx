import { useMemo, useState } from "react";
import { Button } from "../../components/button";
import { StatusIndicator } from "../../components/status-indicator";
import { StatusTag, type StatusTone } from "../../components/status-tag";
import { WorkspaceHeader } from "../../components/workspace-header";
import {
  countServiceStates,
  INITIAL_SERVICE_NODES,
  transitionServiceNode,
  type ServiceNode,
  type ServiceNodeAction,
} from "./serviceNodes";
import "./ros-services.css";

const ACTION_LABELS: Record<ServiceNodeAction, string> = {
  arm: "Arm",
  run: "Run",
  stop: "Stop",
};

const KIND_LABELS: Record<ServiceNode["kind"], string> = {
  launch: "Selected launch",
  lifecycle: "Selected node",
  node: "Selected node",
  rosbag: "Selected recorder",
};

function actionsForStatus(status: StatusTone): ServiceNodeAction[] {
  if (status === "running") return ["stop"];
  if (status === "armed") return ["run", "stop"];
  return ["arm"];
}

interface NodeActionButtonProps {
  action: ServiceNodeAction;
  nodeName: string;
  onAction: (action: ServiceNodeAction) => void;
}

function NodeActionButton({
  action,
  nodeName,
  onAction,
}: NodeActionButtonProps) {
  return (
    <Button
      className={`service-action-button service-action-${action}`}
      aria-label={`${ACTION_LABELS[action]} ${nodeName}`}
      onClick={() => onAction(action)}
    >
      {ACTION_LABELS[action]}
    </Button>
  );
}

interface ServiceNodeRowProps {
  isSelected: boolean;
  node: ServiceNode;
  onAction: (action: ServiceNodeAction) => void;
  onSelect: () => void;
}

function ServiceNodeRow({
  isSelected,
  node,
  onAction,
  onSelect,
}: ServiceNodeRowProps) {
  return (
    <li className={`service-node-row${isSelected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="service-node-select"
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <span className={`service-node-dot service-node-dot-${node.status}`} />
        <span className="service-node-copy">
          <strong>{node.name}</strong>
          <small>{node.description}</small>
        </span>
      </button>

      <div className="service-node-controls">
        <StatusTag status={node.status} />
        {actionsForStatus(node.status).map((action) => (
          <NodeActionButton
            key={action}
            action={action}
            nodeName={node.name}
            onAction={onAction}
          />
        ))}
      </div>
    </li>
  );
}

interface LifecycleStepProps {
  detail: string;
  isCurrent: boolean;
  label: string;
  status: StatusTone;
}

function LifecycleStep({
  detail,
  isCurrent,
  label,
  status,
}: LifecycleStepProps) {
  return (
    <div className="lifecycle-step">
      <span className={`lifecycle-state-dot lifecycle-state-dot-${status}`} />
      <strong>{label}</strong>
      <span>{detail}</span>
      {isCurrent ? (
        <StatusTag label="current" showDot={false} status={status} />
      ) : null}
    </div>
  );
}

interface NodeInspectorProps {
  node: ServiceNode;
  onAction: (action: ServiceNodeAction) => void;
}

function NodeInspector({ node, onAction }: NodeInspectorProps) {
  const isLifecycle = node.kind === "lifecycle";

  return (
    <aside className="node-inspector" aria-label="Selected node details">
      <header className="node-inspector-header">
        <span>{KIND_LABELS[node.kind]}</span>
        <h2>/{node.name}</h2>
        <p>{node.description}</p>
      </header>

      <section className="node-inspector-section">
        <h3>{isLifecycle ? "Lifecycle state" : "Process state"}</h3>
        {isLifecycle ? (
          <div className="lifecycle-flow">
            <LifecycleStep
              label="Stopped"
              detail="unconfigured"
              status="stopped"
              isCurrent={node.status === "stopped"}
            />
            <p aria-hidden="true">↓ lifecycle set → configure</p>
            <LifecycleStep
              label="Armed"
              detail="inactive (configured)"
              status="armed"
              isCurrent={node.status === "armed"}
            />
            <p aria-hidden="true">↓ lifecycle set → activate</p>
            <LifecycleStep
              label="Running"
              detail="active"
              status="running"
              isCurrent={node.status === "running"}
            />
          </div>
        ) : (
          <div className="process-state">
            <StatusTag status={node.status} />
            <span>{node.status === "running" ? "process healthy" : "awaiting command"}</span>
          </div>
        )}
      </section>

      <section className="node-inspector-section">
        <h3>Details</h3>
        <dl className="node-detail-list">
          <div>
            <dt>Package</dt>
            <dd>{node.details.package}</dd>
          </div>
          <div>
            <dt>Executable</dt>
            <dd>{node.details.executable}</dd>
          </div>
          <div>
            <dt>Publishes</dt>
            <dd>{node.details.publishes}</dd>
          </div>
          <div>
            <dt>Subscribes</dt>
            <dd>{node.details.subscribes}</dd>
          </div>
        </dl>

        <h3 className="launch-command-title">Launch command</h3>
        <div className="launch-command" aria-label="Launch commands">
          <code>
            <span>
              <b>$</b> ros2 launch {node.details.package}
            </span>
            <span className="launch-command-indent">{node.details.executable}</span>
            {isLifecycle ? (
              <span>
                <b>$</b> ros2 lifecycle set /{node.name} activate
              </span>
            ) : null}
          </code>
        </div>
      </section>

      <div className="node-inspector-actions">
        {(["arm", "run", "stop"] as const).map((action) => {
          const enabled = actionsForStatus(node.status).includes(action);
          return (
            <Button
              key={action}
              className={`inspector-action-button inspector-action-${action}`}
              disabled={!enabled}
              onClick={() => onAction(action)}
            >
              {ACTION_LABELS[action]}
            </Button>
          );
        })}
      </div>
    </aside>
  );
}

export function RosServicesScreen() {
  const [nodes, setNodes] = useState(() => INITIAL_SERVICE_NODES);
  const [selectedName, setSelectedName] = useState("offboard_control");
  const [announcement, setAnnouncement] = useState("");
  const selectedNode =
    nodes.find((node) => node.name === selectedName) ?? nodes[0];
  const counts = useMemo(() => countServiceStates(nodes), [nodes]);

  const handleAction = (nodeName: string, action: ServiceNodeAction) => {
    setNodes((current) => transitionServiceNode(current, nodeName, action));
    setSelectedName(nodeName);
    setAnnouncement(`${nodeName} is now ${action === "run" ? "running" : action === "arm" ? "armed" : "stopped"}.`);
  };

  const handleRefresh = () => {
    setNodes(INITIAL_SERVICE_NODES);
    setAnnouncement("ROS 2 node list refreshed.");
  };

  return (
    <section className="ros-services-screen">
      <WorkspaceHeader pageLabel="ROS 2 Services" />

      <div className="services-layout">
        <section className="nodes-panel" aria-labelledby="nodes-panel-title">
          <header className="nodes-panel-header">
            <div>
              <h1 id="nodes-panel-title">Nodes &amp; Launch</h1>
              <p>puffin_autonomy package · ros2 launch / lifecycle nodes</p>
            </div>
            <Button
              className="node-list-refresh"
              startIcon={<span aria-hidden="true">↻</span>}
              onClick={handleRefresh}
            >
              ros2 node list
            </Button>
          </header>

          <ul className="service-node-list">
            {nodes.map((node) => (
              <ServiceNodeRow
                key={node.name}
                node={node}
                isSelected={node.name === selectedNode.name}
                onSelect={() => setSelectedName(node.name)}
                onAction={(action) => handleAction(node.name, action)}
              />
            ))}
          </ul>
        </section>

        <NodeInspector
          node={selectedNode}
          onAction={(action) => handleAction(selectedNode.name, action)}
        />
      </div>

      <footer className="services-status-bar">
        <div className="services-status-counts">
          <span>
            Running: <strong>{counts.running}</strong>
          </span>
          <span>
            Armed: <strong>{counts.armed}</strong>
          </span>
          <span>
            Stopped: <strong>{counts.stopped}</strong>
          </span>
          <span>
            Package: <strong>puffin_autonomy</strong>
          </span>
        </div>
        <StatusIndicator label="ROS2 Discovery Server: Optimal Connection" />
      </footer>

      <p className="services-announcement" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
