import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { LifecycleStateName } from "../../components/lifecycle";
import { MissionScene } from "../../components/mission-scene";
import { StatusTag } from "../../components/status-tag";
import { api } from "../../lib/api";
import { isAirborne, runGateTitle } from "../../lib/flightState";
import { connectTelemetry, disconnectTelemetry, useTelemetryStore } from "../../lib/telemetryStore";
import {
  EXECUTOR_NAME,
  flightStatus,
  flightTimeS,
  formatDuration,
  maxAltitudeM,
  plansMatch,
  preflightChecks,
  rowTone,
  totalDistance,
  type FlightPlan,
  type MissionStatus,
  type Waypoint,
} from "./missionMath";
import "./mission-planner.css";

// contract: MissionRequest.name, ^[a-z][a-z0-9_]{0,30}$
const NAME_PATTERN = /^[a-z][a-z0-9_]{0,30}$/;

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
  // the forge makes a separate, permanent node - its name has nothing to do
  // with the mission_planner executor this screen flies
  const [forgeInput, setForgeInput] = useState("mission");
  const [forgedName, setForgedName] = useState<string | null>(null);
  const [lastFlown, setLastFlown] = useState<FlightPlan | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // the socket is opened per screen and closed on the way out, so the planner
  // has to open its own: without it the drone marker, the preflight telemetry
  // check and the airborne gate below all read a store nobody is filling
  useEffect(() => {
    connectTelemetry();
    return () => disconnectTelemetry();
  }, []);

  const { connected, latest } = useTelemetryStore();
  const telemetryLive = connected && latest !== null;
  // the executor streams offboard setpoints from wherever the vehicle is;
  // on the ground that is not a mission. see lib/flightState.
  const airborne = isAirborne(telemetryLive, latest);
  const forgeNameValid = NAME_PATTERN.test(forgeInput);

  const status = useQuery({
    queryKey: ["mission-status"],
    queryFn: async () => (await api.GET("/mission")).data,
    refetchInterval: 1000,
  });

  const nodeLifecycle = useQuery({
    queryKey: ["ros-lifecycle", EXECUTOR_NAME],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/lifecycle/{nodeName}", {
        params: { path: { nodeName: EXECUTOR_NAME } },
      });
      if (error) throw new Error("Failed to fetch lifecycle state");
      return data;
    },
    refetchInterval: 5000,
  });
  const nodeState = nodeLifecycle.data?.state as LifecycleStateName | undefined;
  const flying = nodeState === "active";
  const { label: statusLabel, tone: statusTone } = flightStatus(nodeState);

  // the executor's own status only describes the plan/node it's actually
  // holding - only trust it when it's talking about mission_planner
  const activeStatus =
    status.data?.node === EXECUTOR_NAME ? (status.data as MissionStatus) : undefined;

  const currentPlan: FlightPlan = { waypoints, rateHz, takeoffZ, returnToOrigin };
  // once mission_planner is flying, only a stop+fly applies further edits -
  // this just flags that the editor has drifted from what's airborne
  const editedSinceLaunch = flying && lastFlown !== null && !plansMatch(currentPlan, lastFlown);

  // fly mission: latch the current plan onto mission_planner, then activate
  // it - prime -> activate. no arm step: the button only unlocks once the
  // vehicle is already airborne, and getting there took a takeoff, which
  // took an arm. arming here would only ever be a no-op or a lie.
  const fly = useMutation({
    mutationFn: async () => {
      const plan = currentPlan;
      const mission = await api.POST("/mission", {
        body: {
          name: EXECUTOR_NAME,
          waypoints: plan.waypoints,
          rate_hz: plan.rateHz,
          takeoff_z: plan.takeoffZ,
          return_to_origin: plan.returnToOrigin,
        },
      });
      if (mission.error || !mission.data?.ok) throw new Error(mission.data?.detail ?? "prime failed");

      const activate = await api.POST("/ros/lifecycle/{nodeName}/transition", {
        params: { path: { nodeName: EXECUTOR_NAME } },
        body: { transition: "activate" },
      });
      if (activate.error || !activate.data.ok) {
        throw new Error(activate.data?.detail ?? "activate failed");
      }
      return { detail: activate.data.detail, plan };
    },
    onSuccess: ({ detail, plan }) => {
      setAnnouncement(detail || `${EXECUTOR_NAME} flying`);
      setLastFlown(plan);
      void queryClient.invalidateQueries({ queryKey: ["ros-lifecycle", EXECUTOR_NAME] });
      void queryClient.invalidateQueries({ queryKey: ["mission-status"] });
    },
    onError: (err) => setAnnouncement(err instanceof Error ? err.message : "fly failed"),
  });

  // stop: deactivate mission_planner - px4 holds position, it doesn't land
  const stop = useMutation({
    mutationFn: async () => {
      const res = await api.POST("/ros/lifecycle/{nodeName}/transition", {
        params: { path: { nodeName: EXECUTOR_NAME } },
        body: { transition: "deactivate" },
      });
      if (res.error || !res.data.ok) throw new Error(res.data?.detail ?? "stop failed");
      return res.data;
    },
    onSuccess: () => {
      setAnnouncement("px4 holds in loiter");
      void queryClient.invalidateQueries({ queryKey: ["ros-lifecycle", EXECUTOR_NAME] });
      void queryClient.invalidateQueries({ queryKey: ["mission-status"] });
    },
    onError: (err) => setAnnouncement(err instanceof Error ? err.message : "stop failed"),
  });

  // the forge renders the same plan into a standalone package + supervised
  // program instead of latching it onto mission_planner - a separate,
  // permanent node the pilot names themselves
  const forge = useMutation({
    mutationFn: async () => {
      const res = await api.POST("/mission/forge", {
        body: {
          name: forgeInput,
          waypoints,
          rate_hz: rateHz,
          takeoff_z: takeoffZ,
          return_to_origin: returnToOrigin,
        },
      });
      if (res.error || !res.data?.ok) throw new Error(res.data?.detail ?? "forge failed");
      return res.data;
    },
    onSuccess: (data) => {
      setAnnouncement(data.detail);
      setForgedName(forgeInput);
      void queryClient.invalidateQueries({ queryKey: ["mission-forge", forgeInput] });
    },
    onError: (err) => setAnnouncement(err instanceof Error ? err.message : "forge failed"),
  });

  const forgeStatus = useQuery({
    queryKey: ["mission-forge", forgedName],
    queryFn: async () => {
      const { data, error } = await api.GET("/mission/forge/{name}", {
        params: { path: { name: forgedName as string } },
      });
      if (error) throw new Error("failed to fetch forge status");
      return data;
    },
    enabled: forgedName !== null,
    // stop polling once the build has landed somewhere terminal
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "queued" || state === "building" ? 2000 : false;
    },
  });
  // state of the most recently forged name - its detail text names the node,
  // so it stays legible even after the node-name field is edited further
  const forgeState = forgeStatus.data?.state;
  // true once the typed name has drifted from what was actually forged, so
  // editing the name always re-enables the button even mid-build
  const forgeStale = forgedName !== null && forgedName !== forgeInput;
  // covers the gap between a successful POST and the first GET resolving,
  // so a fast double-click can't fire a second forge for the same name
  const forgeInFlight = forgeStatus.isFetching && forgeStatus.data === undefined;
  const forgeBusy =
    !forgeStale &&
    (forge.isPending || forgeInFlight || forgeState === "queued" || forgeState === "building");

  useEffect(() => {
    if (forgeState === "done" && forgeStatus.data) {
      setAnnouncement(forgeStatus.data.detail);
      void queryClient.invalidateQueries({ queryKey: ["ros-services"] });
    }
  }, [forgeState, forgeStatus.data, queryClient]);

  const update = (index: number, patch: Partial<Waypoint>) =>
    setWaypoints((wps) => wps.map((wp, i) => (i === index ? { ...wp, ...patch } : wp)));

  const distance = totalDistance(waypoints, takeoffZ, returnToOrigin);
  const time = flightTimeS(waypoints, takeoffZ, returnToOrigin);
  const checks = useMemo(
    () => preflightChecks(waypoints, takeoffZ, telemetryLive, nodeState),
    [waypoints, takeoffZ, telemetryLive, nodeState],
  );

  return (
    <section className="mission-screen">
      <div className="mission-layout">
        <section className="mission-main" aria-labelledby="mission-title">
          <header className="mission-header">
            <div>
              <h1 id="mission-title">Mission Planner</h1>
              <p>ned waypoints streamed as offboard setpoints by {EXECUTOR_NAME}</p>
            </div>
            <StatusTag status={statusTone} label={statusLabel} />
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
              <strong>Flight Settings</strong>
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

          <div className="mission-forge-name">
            <label>
              Node name
              <input
                type="text"
                value={forgeInput}
                aria-invalid={!forgeNameValid}
                onChange={(e) => setForgeInput(e.target.value)}
              />
            </label>
            {!forgeNameValid ? (
              <p className="mission-name-error">
                lowercase letters, digits, underscore only; must start with a letter (max 31 chars)
              </p>
            ) : null}
          </div>

          {editedSinceLaunch ? (
            <p className="mission-edited-hint">edited since launch - stop and fly again to apply</p>
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
            <button
              type="button"
              className="mission-forge"
              onClick={() => forge.mutate()}
              disabled={forgeBusy || waypoints.length === 0 || !forgeNameValid}
              title={
                !forgeNameValid
                  ? "lowercase letters, digits, underscore only; must start with a letter (max 31 chars)"
                  : forgeBusy
                    ? `/${forgeInput} forge is ${forgeState ?? "in progress"}`
                    : `builds /${forgeInput} into a standalone package + supervised program`
              }
            >
              Create Node
            </button>
            {/* the title sits on the wrapper, not the button: a disabled
                button swallows hover, so the reason would never show */}
            <span
              className="mission-fly-gate"
              title={
                flying
                  ? `deactivates ${EXECUTOR_NAME}; px4 holds in loiter`
                  : (runGateTitle(airborne) ??
                    `latches this plan onto ${EXECUTOR_NAME} and activates it`)
              }
            >
              <button
                type="button"
                className={flying ? "mission-fly mission-fly-stop" : "mission-fly"}
                onClick={() => (flying ? stop.mutate() : fly.mutate())}
                // stop is never gated - it is the way out of a bad flight
                disabled={
                  flying
                    ? stop.isPending
                    : fly.isPending || waypoints.length === 0 || !airborne
                }
              >
                {flying ? "Stop" : "Fly mission"}
              </button>
            </span>
          </div>

          {forgedName && forgeState ? (
            <p className={`mission-forge-status mission-forge-tone-${forgeState}`}>
              {forgeStatus.data?.detail}
            </p>
          ) : null}

          <p className="mission-announcement" aria-live="polite">
            {announcement}
          </p>
        </aside>
      </div>
    </section>
  );
}
