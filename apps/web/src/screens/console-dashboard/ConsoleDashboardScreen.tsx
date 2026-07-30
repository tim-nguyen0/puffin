import { Button } from "../../components/button";
import { DashboardPanel } from "../../components/dashboard-panel";
import { MetricCard } from "../../components/metric-card";
import { PuffinLogo } from "../../components/puffin-logo";
import { StatusIndicator } from "../../components/status-indicator";
import { StatusTag } from "../../components/status-tag";
import { TerminalConsole } from "../../components/terminal-console";
import "./console-dashboard.css";

const METRICS = [
  { label: "Active Nodes", value: "8", valueAccent: "blue" as const },
  { label: "Topics", value: "15", valueAccent: "blue" as const },
  { label: "Vehicles", value: "1", valueAccent: "blue" as const },
  { label: "Msg Rate", value: "1.2k/s", valueAccent: "green" as const },
];

const TELEMETRY = [
  ["Altitude", "25.4 m"],
  ["Ground Speed", "0.0 m/s"],
  ["Heading", "045° NE"],
  ["Battery", "98%"],
  ["GPS", "12 sats"],
];

const SERVICES = [
  ["gz-server", "physics · DART"],
  ["px4", "SITL · standalone"],
  ["dds-agent", "uORB ↔ ROS 2"],
  ["ros", "autonomy"],
  ["vnc", "gz sim -g + noVNC"],
  ["api", "MAVSDK + ws"],
  ["web", "nginx :80"],
];

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 3.5 11.5 8 5 12.5v-9Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ConsoleHeader() {
  return (
    <header className="console-header">
      <PuffinLogo className="console-brand" />
      <nav aria-label="Breadcrumb">
        <span>rospackage-4</span>
        <i>/</i>
        <strong>dashboard</strong>
      </nav>
      <div className="console-controls">
        <Button startIcon={<PlayIcon />}>Run</Button>
        <button type="button" aria-label="Pause simulation">Ⅱ</button>
        <button type="button" aria-label="Stop simulation">■</button>
      </div>
      <div className="console-header-status">
        <StatusIndicator label="gazebo" />
        <StatusIndicator label="px4" />
        <StatusIndicator label="dds" />
        <code>SIM 00:04:12</code>
        <code>RTF 1.00x</code>
      </div>
    </header>
  );
}

function ConsoleViewport() {
  return (
    <DashboardPanel
      className="console-panel console-viewport-panel"
      title="gazebo"
      headerAction={
        <div className="console-viewport-meta">
          <span><i />GZ Sim -s · noVNC :6080</span>
          <code>FPS 60</code>
        </div>
      }
    >
      <div className="console-viewport">
        <div className="console-vehicle">
          <span />
          <code>x500 · /px4_0 · OFFBOARD</code>
        </div>
      </div>
    </DashboardPanel>
  );
}

function TelemetryPanel() {
  return (
    <DashboardPanel className="console-panel console-telemetry-panel" title="Telemetry">
      <dl>
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
          <dd className="console-flight-mode">
            <StatusTag status="running" label="ARMED" />
            <b>OFFBOARD</b>
          </dd>
        </div>
      </dl>
    </DashboardPanel>
  );
}

function ServicesPanel() {
  return (
    <DashboardPanel
      className="console-panel console-services-panel"
      title="Services"
      headerAction={<span className="console-healthy"><i />7/7</span>}
    >
      <ul>
        {SERVICES.map(([name, description]) => (
          <li key={name}>
            <i />
            <strong>{name}</strong>
            <span>{description}</span>
            <b>up</b>
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}

function ConsoleTerminal() {
  return (
    <TerminalConsole
      className="console-terminal"
      title="compose"
      tabs={[
        { label: "compose", value: "compose" },
        { label: "px4 pxh", value: "px4" },
        { label: "ros2", value: "ros2" },
        { label: "gazebo", value: "gazebo" },
      ]}
      lines={[
        <><b>puffin@sim:~$</b> docker compose up</>,
        <>[+] Running 7/7</>,
        <>✓ gz-server · <b>Started</b> · headless physics · gz sim -s · DART</>,
        <>✓ px4 · <b>Started</b> · SITL · PX4_GZ_STANDALONE=1 · lockstep</>,
        <>✓ dds-agent · <b>Started</b> · uORB ↔ ROS 2 · uXRCE-DDS</>,
        <>✓ ros · <b>Started</b> · autonomy nodes · bind-mount</>,
        <>✓ vnc · <b>Started</b> · Xvfb + gz sim -g + noVNC (pixels)</>,
        <>✓ api · <b>Started</b> · MAVSDK + telemetry ws (numbers)</>,
        <>✓ web · <b>Started</b> · nginx single-origin · :80</>,
        <><mark>[px4]</mark> EKF2 converged · Ready for takeoff!</>,
        <><b>[offboard_control]</b> streaming /fmu/in/trajectory_setpoint @ 50 Hz</>,
      ]}
      prompt={<><b>puffin@sim:~$</b> ros2 lifecycle set /offboard_control activate▋</>}
    />
  );
}

export function ConsoleDashboardScreen() {
  return (
    <section className="console-dashboard-screen">
      <ConsoleHeader />
      <div className="console-dashboard-main">
        <div className="console-workspace">
          <div className="console-primary">
            <div className="console-metrics">
              {METRICS.map((metric) => (
                <MetricCard
                  key={metric.label}
                  {...metric}
                  mono
                  showIndicator={false}
                  tone="dark"
                />
              ))}
            </div>
            <ConsoleViewport />
          </div>
          <aside>
            <TelemetryPanel />
            <ServicesPanel />
          </aside>
        </div>
        <ConsoleTerminal />
      </div>
    </section>
  );
}
