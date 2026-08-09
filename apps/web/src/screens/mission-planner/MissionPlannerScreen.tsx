import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StatusTag } from "../../components/status-tag";
import { api } from "../../lib/api";
import { useTelemetryStore } from "../../lib/telemetryStore";
import {
  flightTimeS,
  formatDuration,
  maxAltitudeM,
  missionPath,
  preflightChecks,
  rowTone,
  totalDistance,
  type MissionStatus,
  type Waypoint,
} from "./missionMath";
import "./mission-planner.css";

const EXECUTOR = "mission_node";

// the demo square, so the screen opens with a flyable plan
const DEFAULT_PLAN: Waypoint[] = [
  { x: 10, y: 0, z: -5, hold_s: 0 },
  { x: 10, y: 10, z: -5, hold_s: 0 },
  { x: 0, y: 10, z: -5, hold_s: 0 },
  { x: 0, y: 0, z: -5, hold_s: 0 },
];

const CANVAS_W = 800;
const CANVAS_H = 560;

interface MapProps {
  drone: { x: number; y: number } | null;
  returnToOrigin: boolean;
  takeoffZ: number;
  waypoints: Waypoint[];
}

function MissionMap({ drone, returnToOrigin, takeoffZ, waypoints }: MapProps) {
  // world -> canvas: east right, north up
  const points = missionPath(waypoints, takeoffZ, returnToOrigin)
    .map((p) => ({ east: p.y, north: p.x }))
    .concat(drone ? [{ east: drone.y, north: drone.x }] : []);
  const spread = Math.max(
    10,
    ...points.map((p) => Math.abs(p.east)),
    ...points.map((p) => Math.abs(p.north)),
  );
  const extent = spread * 1.3;
  const scale = Math.min(CANVAS_W, CANVAS_H) / (extent * 2);
  const toX = (east: number) => CANVAS_W / 2 + east * scale;
  const toY = (north: number) => CANVAS_H / 2 - north * scale;

  // grid step that keeps lines readable at any zoom
  const step = [5, 10, 25, 50, 100].find((s) => s * scale >= 48) ?? 200;
  const lines: number[] = [];
  for (let v = step; v <= extent; v += step) lines.push(v, -v);

  const pathPoints = missionPath(waypoints, takeoffZ, returnToOrigin)
    .map((p) => `${toX(p.y).toFixed(1)},${toY(p.x).toFixed(1)}`)
    .join(" ");

  return (
    <div className="mission-map">
      <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} role="img" aria-label="Mission map, north up">
        <g className="mission-grid">
          <line x1={0} y1={toY(0)} x2={CANVAS_W} y2={toY(0)} />
          <line x1={toX(0)} y1={0} x2={toX(0)} y2={CANVAS_H} />
          {lines.map((v) => (
            <g key={v}>
              <line x1={0} y1={toY(v)} x2={CANVAS_W} y2={toY(v)} />
              <line x1={toX(v)} y1={0} x2={toX(v)} y2={CANVAS_H} />
            </g>
          ))}
        </g>
        <polyline className="mission-path" points={pathPoints} />
        <circle className="mission-origin" cx={toX(0)} cy={toY(0)} r={6} />
        {waypoints.map((wp, i) => (
          <g key={`${i}-${wp.x}-${wp.y}`}>
            <circle className="mission-wp" cx={toX(wp.y)} cy={toY(wp.x)} r={9} />
            <text className="mission-wp-label" x={toX(wp.y)} y={toY(wp.x)}>
              {i + 1}
            </text>
          </g>
        ))}
        {drone ? (
          <circle className="mission-drone" cx={toX(drone.y)} cy={toY(drone.x)} r={7} />
        ) : null}
      </svg>
      <span className="mission-map-scale">grid {step} m · north up · ned</span>
    </div>
  );
}

export function MissionPlannerScreen() {
  const queryClient = useQueryClient();
  const [waypoints, setWaypoints] = useState<Waypoint[]>(DEFAULT_PLAN);
  const [rateHz, setRateHz] = useState(20);
  const [takeoffZ, setTakeoffZ] = useState(-3);
  const [returnToOrigin, setReturnToOrigin] = useState(true);
  const [showPreflight, setShowPreflight] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const { connected, latest } = useTelemetryStore();
  const telemetryLive = connected && latest !== null;

  const status = useQuery({
    queryKey: ["mission-status"],
    queryFn: async () => (await api.GET("/mission")).data,
    refetchInterval: 1000,
  });

  const executor = useQuery({
    queryKey: ["ros-lifecycle", EXECUTOR],
    queryFn: async () => {
      const { data } = await api.GET("/ros/lifecycle/{nodeName}", {
        params: { path: { nodeName: EXECUTOR } },
      });
      return data;
    },
    refetchInterval: 5000,
  });
  const executorState = executor.data?.state;
  const flying = executorState === "active";

  const start = useMutation({
    mutationFn: async () => {
      // latch -> arm -> activate; each step reports its own failure
      const latch = await api.POST("/mission", {
        body: { name: "mission", waypoints, rate_hz: rateHz, takeoff_z: takeoffZ, return_to_origin: returnToOrigin },
      });
      if (latch.error || !latch.data?.ok) {
        throw new Error(latch.data?.detail ?? "mission latch failed");
      }
      const arm = await api.POST("/vehicle/arm");
      if (arm.error || !arm.data.ok) throw new Error(arm.data?.detail ?? "arm failed");
      const act = await api.POST("/ros/lifecycle/{nodeName}/transition", {
        params: { path: { nodeName: EXECUTOR } },
        body: { transition: "activate" },
      });
      if (act.error || !act.data.ok) throw new Error(act.data?.detail ?? "activate failed");
      return act.data;
    },
    onSuccess: () => setAnnouncement("mission started"),
    onError: (err) => setAnnouncement(err instanceof Error ? err.message : "start failed"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["ros-lifecycle", EXECUTOR] });
      void queryClient.invalidateQueries({ queryKey: ["mission-status"] });
    },
  });

  const abort = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/ros/lifecycle/{nodeName}/transition", {
        params: { path: { nodeName: EXECUTOR } },
        body: { transition: "deactivate" },
      });
      if (error || !data.ok) throw new Error(data?.detail ?? "deactivate failed");
      return data;
    },
    onSuccess: () => setAnnouncement("mission aborted; px4 holds in loiter"),
    onError: (err) => setAnnouncement(err instanceof Error ? err.message : "abort failed"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["ros-lifecycle", EXECUTOR] });
    },
  });

  const update = (index: number, patch: Partial<Waypoint>) =>
    setWaypoints((wps) => wps.map((wp, i) => (i === index ? { ...wp, ...patch } : wp)));

  const distance = totalDistance(waypoints, takeoffZ, returnToOrigin);
  const time = flightTimeS(waypoints, takeoffZ, returnToOrigin);
  const checks = useMemo(
    () => preflightChecks(waypoints, takeoffZ, telemetryLive, executorState),
    [waypoints, takeoffZ, telemetryLive, executorState],
  );

  return (
    <section className="mission-screen">
      <div className="mission-layout">
        <section className="mission-main" aria-labelledby="mission-title">
          <header className="mission-header">
            <div>
              <h1 id="mission-title">Mission Planner</h1>
              <p>ned waypoints streamed as offboard setpoints by mission_node</p>
            </div>
            <StatusTag
              status={flying ? "running" : executorState ? "armed" : "stopped"}
              label={flying ? "executing" : (executorState ?? "executor offline")}
            />
          </header>
          <MissionMap
            waypoints={waypoints}
            takeoffZ={takeoffZ}
            returnToOrigin={returnToOrigin}
            drone={telemetryLive && latest ? { x: latest.ned.x, y: latest.ned.y } : null}
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
            {status.data && status.data.state !== "idle" ? (
              <span className="mission-stats-status">
                executor <strong>{status.data.state}</strong>
                {status.data.detail ? ` · ${status.data.detail}` : ""}
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
              <strong>Arm &amp; Engage Offboard</strong>
            </header>
            <div className="mission-field-row">
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
          </div>

          <ol className="mission-wp-list">
            {waypoints.map((wp, i) => {
              const tone = rowTone(i, status.data as MissionStatus | undefined);
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
            {flying ? (
              <button
                type="button"
                className="mission-abort"
                onClick={() => abort.mutate()}
                disabled={abort.isPending}
              >
                Abort
              </button>
            ) : (
              <button
                type="button"
                className="mission-start"
                onClick={() => start.mutate()}
                disabled={start.isPending || waypoints.length === 0}
              >
                Start Offboard
              </button>
            )}
          </div>

          <p className="mission-announcement" aria-live="polite">
            {announcement}
          </p>
        </aside>
      </div>
    </section>
  );
}
