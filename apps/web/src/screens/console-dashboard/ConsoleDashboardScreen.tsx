import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/button";
import { DashboardPanel } from "../../components/dashboard-panel";
import { MetricCard } from "../../components/metric-card";
import { PuffinLogo } from "../../components/puffin-logo";
import { SimViewport } from "../../components/sim-viewport";
import { StatusIndicator } from "../../components/status-indicator";
import { StatusTag } from "../../components/status-tag";
import { TerminalConsole } from "../../components/terminal-console";
import { api } from "../../lib/api";
import {
  connectTelemetry,
  disconnectTelemetry,
  useTelemetryStore,
} from "../../lib/telemetryStore";
import "./console-dashboard.css";

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 3.5 11.5 8 5 12.5v-9Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function formatUptime(seconds: number | undefined): string {
  if (seconds === undefined) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ConsoleDashboardScreen() {
  const queryClient = useQueryClient();
  const { connected, latest } = useTelemetryStore();

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

  const graph = useQuery({
    queryKey: ["ros-graph"],
    queryFn: async () => {
      const { data, error } = await api.GET("/ros/graph");
      if (error) throw new Error("Failed to fetch graph");
      return data;
    },
    refetchInterval: 10000,
  });

  const invalidateStatus = () =>
    queryClient.invalidateQueries({ queryKey: ["sim-status"] });
  const start = useMutation({
    mutationFn: async () => (await api.POST("/sim/start")).data,
    onSettled: invalidateStatus,
  });
  const stop = useMutation({
    mutationFn: async () => (await api.POST("/sim/stop")).data,
    onSettled: invalidateStatus,
  });

  const procs = simStatus.data?.processes ?? [];
  const running = procs.filter((proc) => proc.state === "RUNNING").length;
  const byName = new Map(procs.map((proc) => [proc.name, proc.state]));
  const gzUptime = procs.find((proc) => proc.name === "gz-server")?.uptime_s;

  const metrics = [
    {
      label: "Nodes",
      value: String(graph.data?.nodes.length ?? "—"),
      valueAccent: "blue" as const,
    },
    {
      label: "Topics",
      value: String(graph.data?.topics.length ?? "—"),
      valueAccent: "blue" as const,
    },
    { label: "Vehicles", value: "1", valueAccent: "blue" as const },
    {
      label: "Telemetry",
      value: connected ? "LIVE" : "DOWN",
      valueAccent: (connected ? "green" : undefined) as "green" | undefined,
    },
  ];

  return (
    <section className="console-dashboard-screen">
      <header className="console-header">
        <PuffinLogo className="console-brand" />
        <nav aria-label="Breadcrumb">
          <span>rospackage-4</span>
          <i>/</i>
          <strong>console</strong>
          <i>/</i>
          <Link to="/dashboard">exit</Link>
        </nav>
        <div className="console-controls">
          <Button
            startIcon={<PlayIcon />}
            onClick={() => start.mutate()}
            disabled={start.isPending || stop.isPending}
          >
            Run
          </Button>
          <button
            type="button"
            aria-label="Pause simulation"
            title="Pause is not available yet"
            disabled
          >
            Ⅱ
          </button>
          <button
            type="button"
            aria-label="Stop simulation"
            onClick={() => stop.mutate()}
            disabled={start.isPending || stop.isPending}
          >
            ■
          </button>
        </div>
        <div className="console-header-status">
          <StatusIndicator label="gazebo" active={byName.get("gz-server") === "RUNNING"} />
          <StatusIndicator label="px4" active={byName.get("px4") === "RUNNING"} />
          <StatusIndicator label="dds" active={byName.get("xrce-agent") === "RUNNING"} />
          <code>SIM {formatUptime(gzUptime)}</code>
        </div>
      </header>
      <div className="console-dashboard-main">
        <div className="console-workspace">
          <div className="console-primary">
            <div className="console-metrics">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} mono showIndicator={false} tone="dark" />
              ))}
            </div>
            <DashboardPanel
              className="console-panel console-viewport-panel"
              title="gazebo"
              headerAction={
                <div className="console-viewport-meta">
                  <span>
                    <i />
                    gz sim -s · noVNC /novnc
                  </span>
                </div>
              }
            >
              <div className="console-viewport">
                <SimViewport />
              </div>
            </DashboardPanel>
          </div>
          <aside>
            <DashboardPanel className="console-panel console-telemetry-panel" title="Telemetry">
              <dl>
                <div>
                  <dt>Altitude</dt>
                  <dd>{latest ? `${(-latest.ned.z).toFixed(2)} m` : "—"}</dd>
                </div>
                <div>
                  <dt>North</dt>
                  <dd>{latest ? `${latest.ned.x.toFixed(2)} m` : "—"}</dd>
                </div>
                <div>
                  <dt>East</dt>
                  <dd>{latest ? `${latest.ned.y.toFixed(2)} m` : "—"}</dd>
                </div>
                <div>
                  <dt>Battery</dt>
                  <dd className={latest ? "is-healthy" : ""}>
                    {latest ? `${latest.battery_v.toFixed(2)} V` : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Flight Mode</dt>
                  <dd className="console-flight-mode">
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
              className="console-panel console-services-panel"
              title="Services"
              headerAction={
                <span className="console-healthy">
                  <i />
                  {running}/{procs.length}
                </span>
              }
            >
              <ul>
                {procs.map((proc) => (
                  <li key={proc.name}>
                    <i />
                    <strong>{proc.name}</strong>
                    <span>up {formatUptime(proc.uptime_s)}</span>
                    <b>{proc.state === "RUNNING" ? "up" : proc.state.toLowerCase()}</b>
                  </li>
                ))}
              </ul>
            </DashboardPanel>
          </aside>
        </div>
        <TerminalConsole
          className="console-terminal"
          title="procs"
          lines={[
            <>
              <b>puffin@sim:~$</b> make procs
            </>,
            ...procs.map((proc) => (
              <>
                {proc.state === "RUNNING" ? "✓" : "✗"} {proc.name} · <b>{proc.state}</b> · up{" "}
                {formatUptime(proc.uptime_s)}
              </>
            )),
          ]}
          prompt={
            <>
              <b>puffin@sim:~$</b> ▋
            </>
          }
          statusLabel={simStatus.isError ? "○ unreachable" : "● running"}
        />
      </div>
    </section>
  );
}
