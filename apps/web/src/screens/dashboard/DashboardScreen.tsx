import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../components/button";
import { SimViewport } from "../../components/sim-viewport";
import { api } from "../../lib/api";
import { connectTelemetry, disconnectTelemetry, useTelemetryStore } from "../../lib/telemetryStore";
import "./dashboard.css";

export function DashboardScreen() {
  const queryClient = useQueryClient();
  const { connected, latest } = useTelemetryStore();
  const [altitude, setAltitude] = useState("10");
  const [actionError, setActionError] = useState<string | null>(null);

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
    onError: onCommandError,
  });

  const disarm = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/vehicle/disarm");
      if (error || !data.ok) throw new Error(data?.detail ?? "Disarm failed");
      return data;
    },
    onError: onCommandError,
  });

  const land = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/vehicle/land");
      if (error || !data.ok) throw new Error(data?.detail ?? "Land failed");
      return data;
    },
    onError: onCommandError,
  });

  const takeoff = useMutation({
    mutationFn: async (altitude_m: number) => {
      const { data, error } = await api.POST("/vehicle/takeoff", { body: { altitude_m } });
      if (error || !data.ok) throw new Error(data?.detail ?? "Takeoff failed");
      return data;
    },
    onError: onCommandError,
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

  return (
    <div className="dashboard-screen">
      <h1>Dashboard</h1>

      <section className="dashboard-section">
        <h2>Simulation</h2>
        {simStatus.isLoading ? <p>Loading sim status…</p> : null}
        {simStatus.isError ? <p className="dashboard-error">Could not reach the API.</p> : null}
        {simStatus.data ? (
          <>
            <p>
              World: <strong>{simStatus.data.world}</strong> —{" "}
              <span className={simStatus.data.running ? "dashboard-ok" : "dashboard-warn"}>
                {simStatus.data.running ? "Running" : "Not running"}
              </span>
            </p>
            {simStatus.data.processes.length === 0 ? (
              <p className="dashboard-empty">No processes reported.</p>
            ) : (
              <ul className="dashboard-process-list">
                {simStatus.data.processes.map((proc) => (
                  <li key={proc.name}>
                    {proc.name}: {proc.state} ({proc.uptime_s}s)
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
      </section>

      <section className="dashboard-section dashboard-section-wide">
        <h2>Simulation View</h2>
        <SimViewport />
      </section>

      <section className="dashboard-section">
        <h2>Live Telemetry</h2>
        <p>
          Connection:{" "}
          <span className={connected ? "dashboard-ok" : "dashboard-warn"}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </p>
        {latest ? (
          <dl className="dashboard-telemetry">
            <dt>Armed</dt>
            <dd>{latest.armed ? "Yes" : "No"}</dd>
            <dt>Mode</dt>
            <dd>{latest.mode}</dd>
            <dt>Position (NED)</dt>
            <dd>
              x: {latest.ned.x.toFixed(2)}, y: {latest.ned.y.toFixed(2)}, z: {latest.ned.z.toFixed(2)}
            </dd>
            <dt>Battery</dt>
            <dd>{latest.battery_v.toFixed(2)} V</dd>
          </dl>
        ) : (
          <p className="dashboard-empty">No telemetry received yet.</p>
        )}
      </section>

      <section className="dashboard-section">
        <h2>Vehicle Controls</h2>
        <div className="dashboard-actions">
          <Button onClick={() => runAction(arm.mutate)} disabled={anyPending}>
            Arm
          </Button>
          <Button onClick={() => runAction(disarm.mutate)} disabled={anyPending}>
            Disarm
          </Button>
          <Button onClick={() => runAction(land.mutate)} disabled={anyPending}>
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
          <Button onClick={handleTakeoff} disabled={anyPending}>
            Takeoff
          </Button>
        </div>
        {actionError ? (
          <p className="dashboard-error" role="alert">
            {actionError}
          </p>
        ) : null}
      </section>
    </div>
  );
}