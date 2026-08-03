import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { DashboardPanel } from "../../components/dashboard-panel";
import { lifecycleNodeNames } from "../../components/lifecycle";
import { MetricCard } from "../../components/metric-card";
import { SimViewport } from "../../components/sim-viewport";
import { StatusTag } from "../../components/status-tag";
import { api } from "../../lib/api";
import { useSettingsStore } from "../../lib/settingsStore";
import {
  connectTelemetry,
  disconnectTelemetry,
  useTelemetryStore,
} from "../../lib/telemetryStore";
import "./simulation.css";

const M_TO_FT = 3.28084;

// the demo square, relative to wherever the node is activated
const SQUARE_PLAN = [
  ["SP1", "+10.0, 0.0, hold"],
  ["SP2", "+10.0, +10.0, hold"],
  ["SP3", "0.0, +10.0, hold"],
  ["SP4", "0.0, 0.0, hold"],
] as const;

function formatUptime(seconds: number | undefined): string {
  if (seconds === undefined) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function SimulationScreen() {
  const { connected, latest } = useTelemetryStore();
  const units = useSettingsStore((state) => state.units);
  const toLength = (meters: number) => (units === "imperial" ? meters * M_TO_FT : meters);
  const lengthUnit = units === "imperial" ? "ft" : "m";

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
    refetchInterval: 5000,
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

  const demoState = useQuery({
    queryKey: ["ros-lifecycle", "offboard_demo"],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/lifecycle/{nodeName}", {
        params: { path: { nodeName: "offboard_demo" } },
      });
      if (error) throw new Error("Failed to fetch lifecycle state");
      return data;
    },
    refetchInterval: 5000,
  });

  const procs = simStatus.data?.processes ?? [];
  const running = procs.filter((proc) => proc.state === "RUNNING").length;
  const gzUptime = procs.find((proc) => proc.name === "gz-server")?.uptime_s;
  const nodes = lifecycleNodeNames(services.data ?? []);
  const demoActive = demoState.data?.state === "active";

  const metrics = [
    { label: "Sim Uptime", value: formatUptime(gzUptime), mono: true, accent: "cyan" as const },
    { label: "Lifecycle Nodes", value: String(nodes.length) },
    { label: "Vehicles", value: "1" },
    {
      label: "Battery",
      value: latest ? `${latest.battery_v.toFixed(2)} V` : "—",
      accent: "green" as const,
    },
    {
      label: "Processes",
      value: simStatus.data ? `${running}/${procs.length}` : "—",
      accent: (running === procs.length ? "green" : "blue") as "green" | "blue",
    },
    { label: "Telemetry", value: connected ? "LIVE" : "DOWN", mono: true },
  ];

  return (
    <section className="simulation-screen">
      <div className="simulation-metrics">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <div className="simulation-layout">
        <div className="simulation-primary">
          <DashboardPanel
            className="simulation-viewport-panel"
            title="Gazebo 3D Viewport"
            headerAction={
              <div className="simulation-viewport-actions">
                <span className="novnc-tag">
                  <i />
                  noVNC · /novnc
                </span>
              </div>
            }
          >
            <div className="simulation-viewport">
              <SimViewport />
            </div>
          </DashboardPanel>

        </div>
        <aside className="simulation-secondary">
          <DashboardPanel
            className="flight-telemetry-panel"
            title="Flight Telemetry"
            headerAction={<code>/fmu/out/*</code>}
          >
            <dl className="simulation-telemetry-list">
              <div>
                <dt>Altitude</dt>
                <dd>{latest ? `${toLength(-latest.ned.z).toFixed(2)} ${lengthUnit}` : "—"}</dd>
              </div>
              <div>
                <dt>North / East</dt>
                <dd>
                  {latest
                    ? `${toLength(latest.ned.x).toFixed(1)} / ${toLength(latest.ned.y).toFixed(1)} ${lengthUnit}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Battery</dt>
                <dd className={latest ? "is-healthy" : ""}>
                  {latest ? `${latest.battery_v.toFixed(2)} V` : "—"}
                </dd>
              </div>
              <div>
                <dt>Link</dt>
                <dd className={connected ? "is-healthy" : ""}>
                  {connected ? "telemetry ws · live" : "disconnected"}
                </dd>
              </div>
              <div>
                <dt>Flight Mode</dt>
                <dd className="flight-mode-value">
                  <StatusTag
                    status={latest?.armed ? "running" : "stopped"}
                    label={latest?.armed ? "ARMED" : "DISARMED"}
                  />
                  <b>{latest?.mode?.toUpperCase() ?? "—"}</b>
                </dd>
              </div>
            </dl>
          </DashboardPanel>

          <DashboardPanel
            className="mission-panel"
            title="Offboard Demo"
            headerAction={
              <code>{demoActive ? "streaming @ 10 Hz" : (demoState.data?.state ?? "…")}</code>
            }
          >
            <ol className="mission-steps">
              {SQUARE_PLAN.map(([label, coords]) => (
                <li key={label} className={demoActive ? "is-active" : ""}>
                  <i />
                  <strong>{label}</strong>
                  <code>{coords}</code>
                  <span>{demoActive ? "flying" : "pending"}</span>
                </li>
              ))}
            </ol>
          </DashboardPanel>
        </aside>
      </div>
      <footer className="simulation-service-strip">
        <strong>Service Health</strong>
        {procs.map((proc) => (
          <span key={proc.name} className={proc.state === "RUNNING" ? "" : "is-down"}>
            <i />
            {proc.name}
          </span>
        ))}
        <b>
          <i />
          {running} / {procs.length} healthy
        </b>
      </footer>
    </section>
  );
}
