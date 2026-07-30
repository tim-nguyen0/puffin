import { AppIcon } from "../../components/app-icon";
import { DashboardPanel } from "../../components/dashboard-panel";
import { StatusTag } from "../../components/status-tag";
import { WorkspaceHeader } from "../../components/workspace-header";
import "./dashboard.css";

const TELEMETRY = [
  ["Altitude", "25.4 m"],
  ["Ground Speed", "0.0 m/s"],
  ["Heading", "045°"],
  ["Battery", "98% (4.1V/cell)"],
  ["GPS Status", "3D Fix (12 sats)"],
  ["Flight Mode", "OFFBOARD"],
];

const SERVICES = [
  ["gz-server", "headless physics · gz sim -s · DART", "up 00:04:12"],
  ["px4", "SITL · PX4_GZ_STANDALONE=1 · lockstep", "up 00:04:10"],
  ["dds-agent", "uORB ↔ ROS 2 · uXRCE-DDS", "up 00:04:09"],
  ["ros", "autonomy nodes · bind-mount", "up 00:04:08"],
  ["vnc", "Xvfb + gz sim -g + noVNC (pixels)", "up 00:04:07"],
  ["api", "MAVSDK + telemetry ws (numbers)", "up 00:04:06"],
  ["web", "nginx · single-origin :80", "up 00:04:06"],
];

function AttitudeIndicator() {
  return (
    <div className="attitude-indicator" aria-label="Level attitude, heading 45 degrees">
      <div className="attitude-sky" />
      <div className="attitude-ground" />
      <div className="attitude-horizon" />
      <span className="attitude-center" />
    </div>
  );
}

function DroneGlyph() {
  return (
    <div className="viewport-drone" aria-label="Quadcopter centered in viewport">
      <AppIcon name="drone" />
      <i className="rotor rotor-one" />
      <i className="rotor rotor-two" />
      <i className="rotor rotor-three" />
      <i className="rotor rotor-four" />
    </div>
  );
}

function ViewportPanel() {
  return (
    <DashboardPanel
      className="viewport-panel"
      title="Gazebo 3D Viewport"
      icon={<AppIcon name="camera" />}
      headerAction={
        <span className="viewport-stats">FPS: 60 · SIM: 00:04:12 · RTF: <b>1.00x</b></span>
      }
    >
      <div className="viewport-scene">
        <DroneGlyph />
      </div>
      <div className="viewport-controls">
        <button type="button">Top</button>
        <button type="button">Front</button>
        <button type="button" className="is-active">Orbit</button>
        <span className="viewport-tools" aria-label="Viewport tools">⌕ · ⊖ · ⛶</span>
      </div>
    </DashboardPanel>
  );
}

function TelemetryPanel() {
  return (
    <DashboardPanel
      className="telemetry-panel"
      title="PX4 Flight Telemetry & Attitude"
      icon={<span aria-hidden="true">◉</span>}
      headerAction={<StatusTag status="running" label="ARMED" />}
    >
      <div className="telemetry-content">
        <AttitudeIndicator />
        <dl className="telemetry-list">
          {TELEMETRY.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={label === "Flight Mode" ? "telemetry-highlight" : ""}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </DashboardPanel>
  );
}

function DiagnosticPanel() {
  return (
    <DashboardPanel
      className="diagnostic-panel"
      title="ROS2 Graph & Diagnostic Log"
      icon={<AppIcon name="network" />}
      headerAction={
        <div className="diagnostic-counts">
          <span>4 Active Nodes</span>
          <span>12 Topics</span>
        </div>
      }
    >
      <div className="node-flow" aria-label="ROS node flow">
        {[
          ["/gazebo_sim", "/world_state"],
          ["/mavros_bridge", "/mavlink"],
          ["/px4_sitl", "/cmd_vel"],
          ["/drone_controller", ""],
        ].map(([node, topic], index) => (
          <div className="node-flow-step" key={node}>
            <div className="node-chip">
              <strong>{node}</strong>
              {topic ? <small>{topic}</small> : null}
            </div>
            {index < 3 ? <span aria-hidden="true">→</span> : null}
          </div>
        ))}
      </div>
      <div className="diagnostic-log" aria-label="Diagnostic log">
        <p><time>[00:04:11.23]</time> [INFO] [/gazebo_sim]: Spawned quadcopter frame at [0, 0, 0]</p>
        <p><time>[00:04:11.09]</time> [INFO] [/mavros_bridge]: Connecting to PX4 SITL on port 14540</p>
        <p className="is-warning"><time>[00:04:12.02]</time> [WARN] [/px4_sitl]: High GPS variance detected, checking fixed point fix</p>
        <p><time>[00:04:12.44]</time> [INFO] [/drone_controller]: Transitioned to OFFBOARD control loop</p>
      </div>
    </DashboardPanel>
  );
}

function HealthPanel() {
  return (
    <DashboardPanel
      className="health-panel"
      title="Pipeline · Service Health"
      icon={<AppIcon name="pipeline" />}
      headerAction={<span className="health-summary"><i />7 / 7 healthy</span>}
    >
      <ul className="health-list">
        {SERVICES.map(([name, detail, uptime]) => (
          <li key={name}>
            <i aria-hidden="true" />
            <strong>{name}</strong>
            <span>{detail}</span>
            <time>{uptime}</time>
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}

export function DashboardScreen() {
  return (
    <section className="dashboard-screen">
      <WorkspaceHeader pageLabel="Simulation Pipeline" />
      <div className="dashboard-grid">
        <ViewportPanel />
        <TelemetryPanel />
        <DiagnosticPanel />
        <HealthPanel />
      </div>
    </section>
  );
}
