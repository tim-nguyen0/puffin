import { useState } from "react";
import { DashboardPanel } from "../../components/dashboard-panel";
import { MetricCard } from "../../components/metric-card";
import { StatusTag } from "../../components/status-tag";
import "./simulation.css";

const METRICS = [
  { label: "Real-Time Factor", value: "1.00x" },
  { label: "Sim Time", value: "00:04:12", mono: true, accent: "cyan" as const },
  { label: "Active Nodes", value: "8" },
  { label: "Vehicles", value: "1" },
  { label: "Battery", value: "98%", accent: "green" as const },
  { label: "Services", value: "7/7", accent: "green" as const },
];

const TELEMETRY = [
  ["Altitude", "25.4 m"],
  ["Ground Speed", "0.0 m/s"],
  ["Heading", "045° NE"],
  ["Battery", "98% · 4.1V/cell"],
  ["GPS", "3D Fix · 12 sats"],
];

const SERVICES = ["gz-server", "px4", "dds-agent", "ros", "vnc", "api", "web"];

function ViewModeControl() {
  const [mode, setMode] = useState("Perspective");

  return (
    <div className="simulation-view-modes" aria-label="Viewport mode">
      {["Perspective", "Ortho", "Free Orbit"].map((label) => (
        <button
          key={label}
          type="button"
          className={mode === label ? "is-active" : undefined}
          aria-pressed={mode === label}
          onClick={() => setMode(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SimulationViewport() {
  return (
    <DashboardPanel
      className="simulation-viewport-panel"
      title="Gazebo 3D Viewport"
      headerAction={
        <div className="simulation-viewport-actions">
          <span className="novnc-tag"><i />noVNC :6080</span>
          <ViewModeControl />
        </div>
      }
    >
      <div className="simulation-viewport">
        <div className="simulation-vehicle">
          <span />
          <code>x500 · /px4_0 · OFFBOARD</code>
        </div>
      </div>
    </DashboardPanel>
  );
}

function FlightTelemetry() {
  return (
    <DashboardPanel
      className="flight-telemetry-panel"
      title="Flight Telemetry"
      headerAction={<code>/fmu/out/*</code>}
    >
      <dl className="simulation-telemetry-list">
        {TELEMETRY.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={label === "Battery" || label === "GPS" ? "is-healthy" : ""}>
              {value}
            </dd>
          </div>
        ))}
        <div>
          <dt>Flight Mode</dt>
          <dd className="flight-mode-value">
            <StatusTag status="running" label="ARMED" />
            <b>OFFBOARD</b>
          </dd>
        </div>
      </dl>
    </DashboardPanel>
  );
}

function MissionPanel() {
  return (
    <DashboardPanel
      className="mission-panel"
      title="Offboard Mission"
      headerAction={<code>streaming @ 50 Hz</code>}
    >
      <ol className="mission-steps">
        <li className="is-reached"><i /><strong>SP1</strong><code>12.0, 8.0, -25.0</code><span>reached</span></li>
        <li className="is-active"><i /><strong>SP2</strong><code>-4.2, 16.1, -30.0</code><span>active</span></li>
        <li><i /><strong>Hold</strong><code>-4.2, 16.1, -25.0</code><span>pending</span></li>
      </ol>
    </DashboardPanel>
  );
}

function TerminalPanel() {
  return (
    <DashboardPanel
      className="terminal-panel"
      title="〉_ Terminal"
      headerAction={
        <div className="terminal-tabs" aria-label="Terminal tabs">
          <b>docker compose</b><span>px4 pxh</span><span>ros2</span><span>gazebo</span><em>● running</em>
        </div>
      }
    >
      <div className="simulation-terminal">
        <code>
          <span><b>$</b> docker compose up</span>
          <span>[+] Running 7/7</span>
          <span>✓ gz-server · <b>Started</b> · headless physics · gz sim -s · DART</span>
          <span>✓ px4 · <b>Started</b> · SITL · PX4_GZ_STANDALONE=1 · lockstep</span>
          <span>✓ dds-agent · <b>Started</b> · uORB ↔ ROS 2 · uXRCE-DDS</span>
          <span>✓ ros · <b>Started</b> · autonomy nodes · bind-mount</span>
          <span>✓ vnc · <b>Started</b> · Xvfb + gz sim -g + noVNC (pixels)</span>
          <span>✓ api · <b>Started</b> · MAVSDK + telemetry ws (numbers)</span>
          <span>✓ web · <b>Started</b> · nginx single-origin · :80</span>
          <span className="terminal-prompt"><b>puffin@sim:~</b>$ ros2 topic echo /fmu/out/vehicle_status▋</span>
        </code>
      </div>
    </DashboardPanel>
  );
}

function ServiceStrip() {
  return (
    <footer className="simulation-service-strip">
      <strong>Service Health</strong>
      {SERVICES.map((service) => <span key={service}><i />{service}</span>)}
      <b><i />7 / 7 healthy</b>
    </footer>
  );
}

export function SimulationScreen() {
  return (
    <section className="simulation-screen">
      <div className="simulation-metrics">
        {METRICS.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="simulation-layout">
        <div className="simulation-primary">
          <SimulationViewport />
          <TerminalPanel />
        </div>
        <aside className="simulation-secondary">
          <FlightTelemetry />
          <MissionPanel />
        </aside>
      </div>
      <ServiceStrip />
    </section>
  );
}
