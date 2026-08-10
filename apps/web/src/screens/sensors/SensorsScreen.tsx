import { AppIcon } from "../../components/app-icon";
import { StatusTag } from "../../components/status-tag";
import { climbRate, nedToLatLon, quatToEulerDeg } from "../../lib/geo";
import { useTelemetryStore } from "../../lib/telemetryStore";
import "./sensors.css";

interface SparklineProps {
  label: string;
  values: number[];
}

function Sparkline({ label, values }: SparklineProps) {
  // an empty plot on the dark trace background read as a broken black bar
  const hasTrace = values.length > 1;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 28 - ((v - min) / span) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className={`sensor-sparkline${hasTrace ? "" : " is-empty"}`}>
      <span>{label}</span>
      {hasTrace ? (
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} />
        </svg>
      ) : (
        <span className="sensor-sparkline-empty">no samples yet</span>
      )}
      <strong>{values.length ? values[values.length - 1].toFixed(1) : "—"}</strong>
    </div>
  );
}

interface SensorCardProps {
  children: React.ReactNode;
  live: boolean;
  liveLabel?: string;
  name: string;
  // installed sensors go offline; absent hardware stays "not installed"
  offlineLabel?: string;
  source: string;
}

function SensorCard({ children, live, liveLabel, name, offlineLabel, source }: SensorCardProps) {
  return (
    <article className="sensor-card">
      <header>
        <div>
          <h2>{name}</h2>
          <span className="sensor-source">{source}</span>
        </div>
        <StatusTag
          status={live ? "running" : "stopped"}
          label={live ? (liveLabel ?? "streaming") : (offlineLabel ?? "not installed")}
        />
      </header>
      {children}
    </article>
  );
}

function NotInstalled({ hint, icon }: { hint: string; icon: "camera" | "radar" }) {
  return (
    <div className="sensor-empty">
      <AppIcon name={icon} />
      <p>{hint}</p>
    </div>
  );
}

export function SensorsScreen() {
  const { connected, latest, history } = useTelemetryStore();
  const live = connected && latest !== null;

  const fix = latest ? nedToLatLon(latest.ned.x, latest.ned.y) : null;
  const climb = climbRate(history);
  const tail = history.slice(-60);
  const eulerTail = tail.map((s) => quatToEulerDeg(s.attitude_q as [number, number, number, number]));

  return (
    <section className="sensors-screen">
      <div className="sensors-layout">
        <section className="sensors-main" aria-labelledby="sensors-title">
          <header className="sensors-header">
            <div>
              <h1 id="sensors-title">Sensors</h1>
              <p>what the spawned x500 actually carries · streamed over the telemetry socket</p>
            </div>
            <StatusTag
              status={live ? "running" : "stopped"}
              label={live ? "telemetry live" : "telemetry offline"}
            />
          </header>

          <div className="sensors-grid">
            <SensorCard name="Camera Feed" source="gz camera sensor" live={false}>
              <NotInstalled
                icon="camera"
                hint="no camera on the x500 airframe — x500_depth carries the OAK-D stereo pair"
              />
            </SensorCard>

            <SensorCard name="LiDAR" source="gz gpu_lidar sensor" live={false}>
              <NotInstalled
                icon="radar"
                hint="no lidar on the x500 airframe — lidar variants exist in newer px4 model sets"
              />
            </SensorCard>

            <SensorCard name="IMU · Attitude" source="/fmu attitude quaternion" live={live} offlineLabel="offline">
              <div className="sensor-sparkline-stack">
                <Sparkline label="roll°" values={eulerTail.map((e) => e.roll)} />
                <Sparkline label="pitch°" values={eulerTail.map((e) => e.pitch)} />
                <Sparkline label="yaw°" values={eulerTail.map((e) => e.yaw)} />
              </div>
            </SensorCard>

            <SensorCard name="GPS" source="ned + world origin" live={live} liveLabel="3d fix (sim)" offlineLabel="offline">
              <dl className="sensor-readout">
                <div>
                  <dt>Latitude</dt>
                  <dd>{fix ? `${fix.lat.toFixed(6)}°` : "—"}</dd>
                </div>
                <div>
                  <dt>Longitude</dt>
                  <dd>{fix ? `${fix.lon.toFixed(6)}°` : "—"}</dd>
                </div>
                <div>
                  <dt>Altitude</dt>
                  <dd>{latest ? `${(-latest.ned.z).toFixed(2)} m` : "—"}</dd>
                </div>
                <div>
                  <dt>Climb</dt>
                  <dd>{latest ? `${climb.toFixed(2)} m/s` : "—"}</dd>
                </div>
              </dl>
            </SensorCard>

            <SensorCard name="Battery Monitor" source="/fmu/out/battery_status" live={live} offlineLabel="offline">
              <div className="sensor-sparkline-stack">
                <Sparkline label="volts" values={tail.map((s) => s.battery_v)} />
              </div>
              <dl className="sensor-readout">
                <div>
                  <dt>Voltage</dt>
                  <dd>{latest ? `${latest.battery_v.toFixed(2)} V` : "—"}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{latest?.mode ?? "—"}</dd>
                </div>
              </dl>
            </SensorCard>

            <SensorCard name="Barometer" source="fused inside px4" live={live} liveLabel="fused" offlineLabel="offline">
              <dl className="sensor-readout">
                <div>
                  <dt>Baro altitude</dt>
                  <dd>{latest ? `${(-latest.ned.z).toFixed(2)} m` : "—"}</dd>
                </div>
                <div>
                  <dt>Raw pressure</dt>
                  <dd>not surfaced</dd>
                </div>
              </dl>
              <p className="sensor-note">
                px4 consumes baro/mag directly from gazebo; only the fused estimate
                reaches the telemetry socket
              </p>
            </SensorCard>
          </div>
        </section>

        <aside className="sensor-editor" aria-label="Add or edit sensor">
          <header className="sensor-editor-header">
            <h2>Add / Edit Sensor</h2>
            <p>sensor changes rewrite the model sdf and need a respawn — on the roadmap</p>
          </header>

          {/* display-only: every control parks disabled until sdf editing ships */}
          <fieldset className="sensor-editor-form" disabled>
            <label>
              Target vehicle
              <select>
                <option>x500 (spawned)</option>
              </select>
            </label>
            <label>
              Sensor type
              <select>
                <option>camera</option>
                <option>gpu_lidar</option>
                <option>imu</option>
                <option>gps</option>
              </select>
            </label>
            <div className="sensor-editor-row">
              <label>
                Mount X
                <input type="number" placeholder="0.0" />
              </label>
              <label>
                Mount Y
                <input type="number" placeholder="0.0" />
              </label>
              <label>
                Mount Z
                <input type="number" placeholder="0.0" />
              </label>
            </div>
            <label>
              Update rate (Hz)
              <input type="number" placeholder="30" />
            </label>
            <label>
              Topic name
              <input type="text" placeholder="/camera/image_raw" />
            </label>
            {/* the fieldset disables it, and disabled controls swallow the
                hover that would show a title */}
            <span title="sdf editing is not wired up yet">
              <button type="button">Save to model &amp; respawn</button>
            </span>
          </fieldset>
        </aside>
      </div>
    </section>
  );
}
