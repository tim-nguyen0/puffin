import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../../components/app-icon";
import { Button } from "../../components/button";
import { DashboardPanel } from "../../components/dashboard-panel";
import { LifecycleQuickPanel } from "../../components/lifecycle";
import { MetricCard } from "../../components/metric-card";
import { SimViewport } from "../../components/sim-viewport";
import { StatusTag } from "../../components/status-tag";
import { TeleopPad } from "../../components/teleop";
import { api } from "../../lib/api";
import { useSettingsStore } from "../../lib/settingsStore";
import { connectTelemetry, disconnectTelemetry, useTelemetryStore } from "../../lib/telemetryStore";
import "./dashboard.css";

const M_TO_FT = 3.28084;

export function DashboardScreen() {
  const queryClient = useQueryClient();
  const { connected, latest } = useTelemetryStore();
  const units = useSettingsStore((state) => state.units);
  const toLength = (meters: number) => (units === "imperial" ? meters * M_TO_FT : meters);
  const lengthUnit = units === "imperial" ? "ft" : "m";
  const [altitude, setAltitude] = useState("10");
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<{
    label: string;
    ok: boolean;
    detail: string;
  } | null>(null);

  useEffect(() => {
    connectTelemetry();
    return () => disconnectTelemetry();
  }, []);

  const simStatus = useQuery({
    queryKey: ["sim-status"],
    queryFn: async () => {
      const { data, error } = await api.GET("/sim/status");
      if (error) throw new Error("Failed to fetch sim status");
      return data;
    },
    refetchInterval: 3000,
  });

  const invalidateSimStatus = () => queryClient.invalidateQueries({ queryKey: ["sim-status"] });
  const onCommandError = (err: unknown) =>
    setActionError(err instanceof Error ? err.message : "Command failed");
  // vehicle commands report their px4 ack (or rejection) in the status strip
  const vehicleResult = (label: string) => ({
    onSuccess: (data: { detail?: string | null }) =>
      setLastCommand({ label, ok: true, detail: data.detail ?? "accepted" }),
    onError: (err: unknown) =>
      setLastCommand({
        label,
        ok: false,
        detail: err instanceof Error ? err.message : "Command failed",
      }),
  });

  const startSim = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/sim/start");
      if (error || !data.ok) throw new Error(data?.detail ?? "Start failed");
      return data;
    },
    onSuccess: invalidateSimStatus,
    onError: onCommandError,
  });

  const stopSim = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/sim/stop");
      if (error || !data.ok) throw new Error(data?.detail ?? "Stop failed");
      return data;
    },
    onSuccess: invalidateSimStatus,
    onError: onCommandError,
  });

  const resetSim = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/sim/reset");
      if (error || !data.ok) throw new Error(data?.detail ?? "Reset failed");
      return data;
    },
    onSuccess: invalidateSimStatus,
    onError: onCommandError,
  });

  const arm = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/vehicle/arm");
      if (error || !data.ok) throw new Error(data?.detail ?? "Arm failed");
      return data;
    },
    ...vehicleResult("arm"),
  });

  const disarm = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/vehicle/disarm");
      if (error || !data.ok) throw new Error(data?.detail ?? "Disarm failed");
      return data;
    },
    ...vehicleResult("disarm"),
  });

  const land = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/vehicle/land");
      if (error || !data.ok) throw new Error(data?.detail ?? "Land failed");
      return data;
    },
    ...vehicleResult("land"),
  });

  const takeoff = useMutation({
    mutationFn: async (altitude_m: number) => {
      const { data, error } = await api.POST("/vehicle/takeoff", { body: { altitude_m } });
      if (error || !data.ok) throw new Error(data?.detail ?? "Takeoff failed");
      return data;
    },
    ...vehicleResult("takeoff"),
  });

  function handleTakeoff() {
    const alt = Number(altitude);
    if (!Number.isFinite(alt) || alt < 1 || alt > 50) {
      setActionError("Altitude must be between 1 and 50 meters.");
      return;
    }
    setActionError(null);
    takeoff.mutate(alt);
  }

  function runAction(mutate: () => void) {
    setActionError(null);
    mutate();
  }

  const anyPending =
    startSim.isPending ||
    stopSim.isPending ||
    resetSim.isPending ||
    arm.isPending ||
    disarm.isPending ||
    land.isPending ||
    takeoff.isPending;

  // an active offboard node owns the vehicle - manual control comes back
  // when it's deactivated. land stays live as the escape hatch: NAV_LAND
  // overrides offboard.
  const offboardActive = latest?.mode === "offboard";
  const manualLockTitle = offboardActive
    ? "offboard node in control - deactivate it on the ROS Services screen"
    : undefined;

  return (
    <div className="dashboard-screen">
      <div className="dashboard-grid">
        <DashboardPanel
          className="viewport-panel dashboard-panel-wide"
          title="Simulation View"
          icon={<AppIcon name="camera" />}
          headerAction={
            <span className="viewport-stats">
              MODE: <b>{latest?.mode ?? "—"}</b> · LINK: <b>{connected ? "LIVE" : "DOWN"}</b>{" "}
              · <Link to="/dashboard/console">console ⛶</Link>
            </span>
          }
        >
          <div className="viewport-body">
            <SimViewport variant="clean" />
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="PX4 Flight Telemetry"
          icon={<AppIcon name="drone" />}
          headerAction={
            <StatusTag
              status={latest?.armed ? "armed" : "stopped"}
              label={latest ? (latest.armed ? "ARMED" : "DISARMED") : "NO LINK"}
            />
          }
        >
          <div className="panel-pad">
            {latest ? (
              <div className="telemetry-metrics">
                <MetricCard
                  label={`Altitude (${lengthUnit})`}
                  value={toLength(-latest.ned.z).toFixed(2)}
                  mono
                  accent="cyan"
                />
                <MetricCard
                  label={`North / East (${lengthUnit})`}
                  value={`${toLength(latest.ned.x).toFixed(1)} / ${toLength(latest.ned.y).toFixed(1)}`}
                  mono
                />
                <MetricCard
                  label="Flight Mode"
                  value={latest.mode}
                  accent="green"
                  valueAccent={offboardActive ? "green" : undefined}
                />
                <MetricCard
                  label="Battery"
                  value={`${latest.battery_v.toFixed(2)} V`}
                  mono
                />
              </div>
            ) : (
              <p className="dashboard-empty">No telemetry received yet.</p>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Control Panel" icon={<AppIcon name="pipeline" />}>
          <div className="panel-pad">
            <div className="dashboard-actions">
              <Button
                onClick={() => runAction(arm.mutate)}
                disabled={anyPending || offboardActive}
                title={manualLockTitle}
              >
                Arm
              </Button>
              <Button
                onClick={() => runAction(disarm.mutate)}
                disabled={anyPending || offboardActive}
                title={manualLockTitle}
              >
                Disarm
              </Button>
              <Button
                onClick={() => runAction(land.mutate)}
                disabled={anyPending}
                title={offboardActive ? "overrides offboard and lands" : undefined}
              >
                Land
              </Button>
            </div>
            <label className="dashboard-field">
              Takeoff altitude (m)
              <input
                type="number"
                min={1}
                max={50}
                value={altitude}
                onChange={(e) => setAltitude(e.target.value)}
              />
            </label>
            <div className="dashboard-actions">
              <Button
                onClick={handleTakeoff}
                disabled={anyPending || offboardActive}
                title={manualLockTitle}
              >
                Takeoff
              </Button>
            </div>
            {actionError ? (
              <p className="dashboard-error" role="alert">
                {actionError}
              </p>
            ) : null}
            <TeleopPad />
            <div className="dashboard-vehicle-status">
              <span className="dashboard-status-chip">
                <span className={`dashboard-status-dot ${latest?.armed ? "is-armed" : ""}`} />
                {latest ? (latest.armed ? "Armed" : "Disarmed") : "No telemetry"}
              </span>
              <span className="dashboard-status-chip">Mode: {latest?.mode ?? "—"}</span>
              {offboardActive ? (
                <span className="dashboard-status-chip dashboard-warn">
                  offboard node in control - manual controls locked
                </span>
              ) : null}
              {lastCommand ? (
                <span
                  className={`dashboard-status-chip ${lastCommand.ok ? "dashboard-ok" : "dashboard-error"}`}
                  role="status"
                >
                  {lastCommand.label}: {lastCommand.detail}
                </span>
              ) : null}
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Simulation Processes"
          icon={<AppIcon name="network" />}
          headerAction={
            simStatus.data ? (
              <StatusTag
                status={simStatus.data.running ? "running" : "stopped"}
                label={simStatus.data.running ? "RUNNING" : "STOPPED"}
              />
            ) : undefined
          }
        >
          <div className="panel-pad">
            {simStatus.isLoading ? <p>Loading sim status…</p> : null}
            {simStatus.isError ? (
              <p className="dashboard-error">Could not reach the API.</p>
            ) : null}
            {simStatus.data ? (
              <>
                <p className="dashboard-world">
                  World: <strong>{simStatus.data.world}</strong>
                </p>
                {simStatus.data.processes.length === 0 ? (
                  <p className="dashboard-empty">No processes reported.</p>
                ) : (
                  <ul className="dashboard-process-list">
                    {simStatus.data.processes.map((proc) => (
                      <li key={proc.name}>
                        <span className="dashboard-process-name">{proc.name}</span>
                        <span className="dashboard-process-uptime">{proc.uptime_s}s</span>
                        <StatusTag
                          status={proc.state === "RUNNING" ? "running" : "stopped"}
                          label={proc.state}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
            <div className="dashboard-actions">
              <Button onClick={() => runAction(startSim.mutate)} disabled={anyPending}>
                Start
              </Button>
              <Button onClick={() => runAction(stopSim.mutate)} disabled={anyPending}>
                Stop
              </Button>
              <Button onClick={() => runAction(resetSim.mutate)} disabled={anyPending}>
                Reset
              </Button>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Lifecycle Nodes" icon={<AppIcon name="sensors" />}>
          <div className="panel-pad">
            <LifecycleQuickPanel />
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
