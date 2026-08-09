import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  actionsForState,
  lifecycleNodeNames,
  toneForState,
  transitionForAction,
  type LifecycleStateName,
  type ServiceNodeAction,
} from "../../components/lifecycle";
import { MissionScene } from "../../components/mission-scene";
import { StatusTag } from "../../components/status-tag";
import { api } from "../../lib/api";
import { useTelemetryStore } from "../../lib/telemetryStore";
import {
  flightTimeS,
  formatDuration,
  maxAltitudeM,
  preflightChecks,
  rowTone,
  totalDistance,
  type MissionStatus,
  type Waypoint,
} from "./missionMath";
import "./mission-planner.css";

// contract: MissionRequest.name, ^[a-z][a-z0-9_]{0,30}$
const NAME_PATTERN = /^[a-z][a-z0-9_]{0,30}$/;

const CONTROL_LABELS: Record<ServiceNodeAction, string> = {
  arm: "Arm",
  run: "Run",
  stop: "Stop",
};

// the demo square, so the screen opens with a flyable plan
const DEFAULT_PLAN: Waypoint[] = [
  { x: 10, y: 0, z: -5, hold_s: 0 },
  { x: 10, y: 10, z: -5, hold_s: 0 },
  { x: 0, y: 10, z: -5, hold_s: 0 },
  { x: 0, y: 0, z: -5, hold_s: 0 },
];

export function MissionPlannerScreen() {
  const queryClient = useQueryClient();
  const [waypoints, setWaypoints] = useState<Waypoint[]>(DEFAULT_PLAN);
  const [rateHz, setRateHz] = useState(20);
  const [takeoffZ, setTakeoffZ] = useState(-3);
  const [returnToOrigin, setReturnToOrigin] = useState(true);
  const [missionName, setMissionName] = useState("mission");
  const [lastPrimed, setLastPrimed] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const { connected, latest } = useTelemetryStore();
  const telemetryLive = connected && latest !== null;
  const nameValid = NAME_PATTERN.test(missionName);

  const status = useQuery({
    queryKey: ["mission-status"],
    queryFn: async () => (await api.GET("/mission")).data,
    refetchInterval: 1000,
  });

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
  // prefer an explicit pick, then the mission we most recently primed, then
  // whatever the discovery list turns up first
  const preferredNode = lastPrimed ? `/${lastPrimed}` : null;
  const selectedNode =
    selected && nodes.includes(selected)
      ? selected
      : preferredNode && nodes.includes(preferredNode)
        ? preferredNode
        : (nodes[0] ?? null);
  const pathName = selectedNode ? selectedNode.replace(/^\//, "") : null;

  const nodeLifecycle = useQuery({
    queryKey: ["ros-lifecycle", pathName],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/lifecycle/{nodeName}", {
        params: { path: { nodeName: pathName as string } },
      });
      if (error) throw new Error("Failed to fetch lifecycle state");
      return data;
    },
    enabled: pathName !== null,
    refetchInterval: 5000,
  });
  const nodeState = nodeLifecycle.data?.state as LifecycleStateName | undefined;
  const flying = nodeState === "active";

  // the executor's own status only describes the plan/node it's actually
  // holding - only trust it when it's talking about what's selected here
  const statusMatchesSelection =
    status.data?.node != null &&
    (status.data.node === pathName || status.data.node === lastPrimed);
  const activeStatus = statusMatchesSelection ? (status.data as MissionStatus) : undefined;

  const prime = useMutation({
    mutationFn: async () => {
      const res = await api.POST("/mission", {
        body: {
          name: missionName,
          waypoints,
          rate_hz: rateHz,
          takeoff_z: takeoffZ,
          return_to_origin: returnToOrigin,
        },
      });
      if (res.error || !res.data?.ok) throw new Error(res.data?.detail ?? "prime failed");
      return res.data;
    },
    onSuccess: (data) => {
      setAnnouncement(data.detail);
      setLastPrimed(missionName);
      // let the freshly primed executor become the control panel's default
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["mission-status"] });
      void queryClient.invalidateQueries({ queryKey: ["ros-services"] });
    },
    onError: (err) => setAnnouncement(err instanceof Error ? err.message : "prime failed"),
  });

  const control = useMutation({
    mutationFn: async (action: ServiceNodeAction) => {
      if (!selectedNode || !pathName) throw new Error("no node selected");
      const transition = transitionForAction(action, nodeState);
      if (!transition) throw new Error(`${action} not valid from ${nodeState ?? "unknown"}`);
      if (action === "run") {
        const arm = await api.POST("/vehicle/arm");
        if (arm.error || !arm.data.ok) throw new Error(arm.data?.detail ?? "arm failed");
      }
      const res = await api.POST("/ros/lifecycle/{nodeName}/transition", {
        params: { path: { nodeName: pathName } },
        body: { transition },
      });
      if (res.error || !res.data.ok) throw new Error(res.data?.detail ?? `${action} failed`);
      return { action, detail: res.data.detail };
    },
    onSuccess: ({ action, detail }) => {
      setAnnouncement(action === "stop" ? "px4 holds in loiter" : (detail ?? `${action} accepted`));
      void queryClient.invalidateQueries({ queryKey: ["ros-lifecycle", pathName] });
      void queryClient.invalidateQueries({ queryKey: ["ros-services"] });
      void queryClient.invalidateQueries({ queryKey: ["mission-status"] });
    },
    onError: (err) => setAnnouncement(err instanceof Error ? err.message : "action failed"),
  });

  const update = (index: number, patch: Partial<Waypoint>) =>
    setWaypoints((wps) => wps.map((wp, i) => (i === index ? { ...wp, ...patch } : wp)));

  const distance = totalDistance(waypoints, takeoffZ, returnToOrigin);
  const time = flightTimeS(waypoints, takeoffZ, returnToOrigin);
  const checks = useMemo(
    () => preflightChecks(waypoints, takeoffZ, telemetryLive, nodeState, selectedNode),
    [waypoints, takeoffZ, telemetryLive, nodeState, selectedNode],
  );

  return (
    <section className="mission-screen">
      <div className="mission-layout">
        <section className="mission-main" aria-labelledby="mission-title">
          <header className="mission-header">
            <div>
              <h1 id="mission-title">Mission Planner</h1>
              <p>
                ned waypoints streamed as offboard setpoints
                {selectedNode ? ` by ${selectedNode}` : ""}
              </p>
            </div>
            <StatusTag
              status={selectedNode ? toneForState(nodeState) : "stopped"}
              label={selectedNode ? (nodeState ?? "…") : "no node selected"}
            />
          </header>
          <MissionScene
            waypoints={waypoints}
            takeoffZ={takeoffZ}
            returnToOrigin={returnToOrigin}
            drone={telemetryLive && latest ? { ...latest.ned } : null}
            activeIndex={activeStatus?.current_index ?? null}
            onChange={(index, wp) => update(index, wp)}
          />
          <footer className="mission-stats">
            <span>
              total distance <strong>{distance.toFixed(0)} m</strong>
            </span>
            <span>
              est flight time <strong>{formatDuration(time)}</strong>
            </span>
            <span>
              max altitude <strong>{maxAltitudeM(waypoints, takeoffZ).toFixed(0)} m</strong>
            </span>
            {activeStatus && activeStatus.state !== "idle" ? (
              <span className="mission-stats-status">
                executor <strong>{activeStatus.state}</strong>
                {activeStatus.detail ? ` · ${activeStatus.detail}` : ""}
              </span>
            ) : null}
          </footer>
        </section>

        <aside className="mission-builder" aria-label="Offboard setpoints">
          <header className="mission-builder-header">
            <h2>Offboard Setpoints</h2>
            <span className="mission-rate-tag">streaming @ {rateHz} Hz</span>
          </header>

          <div className="mission-step">
            <header>
              <span className="mission-step-number">1</span>
              <strong>Prime Mission</strong>
            </header>
            <div className="mission-field-row">
              <label>
                Mission name
                <input
                  type="text"
                  value={missionName}
                  aria-invalid={!nameValid}
                  onChange={(e) => setMissionName(e.target.value)}
                />
              </label>
              <label>
                Setpoint rate (Hz)
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={rateHz}
                  onChange={(e) => setRateHz(Number(e.target.value))}
                />
              </label>
              <label>
                Takeoff Z (down)
                <input
                  type="number"
                  step={0.5}
                  value={takeoffZ}
                  onChange={(e) => setTakeoffZ(Number(e.target.value))}
                />
              </label>
            </div>
            {!nameValid ? (
              <p className="mission-name-error">
                lowercase letters, digits, underscore only; must start with a letter (max 31 chars)
              </p>
            ) : null}
          </div>

          <ol className="mission-wp-list">
            {waypoints.map((wp, i) => {
              const tone = rowTone(i, activeStatus);
              return (
                <li key={i} className={`mission-step mission-wp-${tone}`}>
                  <header>
                    <span className="mission-step-number">{i + 2}</span>
                    <strong>Setpoint SP{i + 1}</strong>
                    {tone !== "pending" ? (
                      <span className={`mission-wp-tone mission-tone-${tone}`}>{tone}</span>
                    ) : null}
                    <button
                      type="button"
                      className="mission-wp-remove"
                      aria-label={`Remove SP${i + 1}`}
                      onClick={() => setWaypoints((wps) => wps.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </header>
                  <div className="mission-field-row">
                    <label>
                      X · North
                      <input
                        type="number"
                        value={wp.x}
                        onChange={(e) => update(i, { x: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Y · East
                      <input
                        type="number"
                        value={wp.y}
                        onChange={(e) => update(i, { y: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Z · Down
                      <input
                        type="number"
                        step={0.5}
                        value={wp.z}
                        onChange={(e) => update(i, { z: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Hold (s)
                      <input
                        type="number"
                        min={0}
                        value={wp.hold_s ?? 0}
                        onChange={(e) => update(i, { hold_s: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mission-builder-buttons">
            <button
              type="button"
              onClick={() =>
                setWaypoints((wps) => {
                  const last = wps[wps.length - 1];
                  return [...wps, { x: (last?.x ?? 0) + 5, y: last?.y ?? 0, z: last?.z ?? takeoffZ, hold_s: 0 }];
                })
              }
            >
              + Waypoint
            </button>
            <label className="mission-return-toggle">
              <input
                type="checkbox"
                checked={returnToOrigin}
                onChange={(e) => setReturnToOrigin(e.target.checked)}
              />
              Return to origin
            </label>
          </div>

          {showPreflight ? (
            <ul className="mission-preflight" aria-label="Preflight checks">
              {checks.map((check) => (
                <li key={check.label} className={check.ok ? "is-ok" : "is-bad"}>
                  <strong>{check.label}</strong>
                  <span>{check.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <section className="mission-control-panel" aria-labelledby="mission-control-title">
            <header className="mission-control-header">
              <h2 id="mission-control-title">Control Panel</h2>
              {selectedNode ? (
                <StatusTag status={toneForState(nodeState)} label={nodeState ?? "…"} />
              ) : null}
            </header>
            <label className="mission-control-select-label">
              Executor node
              <select
                className="mission-control-select"
                value={selectedNode ?? ""}
                disabled={nodes.length === 0}
                onChange={(e) => setSelected(e.target.value || null)}
              >
                {nodes.length === 0 ? <option value="">no lifecycle nodes found</option> : null}
                {nodes.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mission-control-actions">
              {selectedNode ? (
                actionsForState(nodeState).map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={`mission-control-button mission-control-${action}`}
                    disabled={control.isPending}
                    onClick={() => control.mutate(action)}
                  >
                    {CONTROL_LABELS[action]}
                  </button>
                ))
              ) : (
                <p className="mission-control-empty">select a node to control it</p>
              )}
            </div>
          </section>

          <div className="mission-actions">
            <button
              type="button"
              className="mission-clear"
              onClick={() => setWaypoints([])}
              disabled={flying}
            >
              Clear All
            </button>
            <button type="button" onClick={() => setShowPreflight((v) => !v)}>
              Preflight Check
            </button>
            <button
              type="button"
              className="mission-prime"
              onClick={() => prime.mutate()}
              disabled={prime.isPending || waypoints.length === 0 || !nameValid}
              title={
                nodes.includes(`/${missionName}`)
                  ? `rebuilds the /${missionName} executor with this plan`
                  : `creates a new /${missionName} executor`
              }
            >
              Prime Mission
            </button>
          </div>

          <p className="mission-announcement" aria-live="polite">
            {announcement}
          </p>
        </aside>
      </div>
    </section>
  );
}
