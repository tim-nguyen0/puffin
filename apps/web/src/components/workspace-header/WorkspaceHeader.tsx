import { Button } from "../button";
import { StatusIndicator } from "../status-indicator";
import "./workspace-header.css";

interface WorkspaceHeaderProps {
  pageLabel: string;
  packageName?: string;
  onResume?: () => void;
  onStop?: () => void;
  busy?: boolean;
  gazeboUp?: boolean;
  px4Up?: boolean;
  simRunning?: boolean;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.75 3.5 11.5 8l-6.75 4.5v-9Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function WorkspaceHeader({
  pageLabel,
  packageName = "rospackage-4",
  onResume,
  onStop,
  busy = false,
  gazeboUp = false,
  px4Up = false,
  simRunning = false,
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <nav className="workspace-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>{packageName}</li>
          <li aria-current="page">{pageLabel}</li>
        </ol>
      </nav>

      {/* a running sim has nothing to resume - the button reports the state
          instead of offering a start that supervisor would reject. titles ride
          on wrappers because disabled controls never fire the hover that shows
          one. */}
      <div className="workspace-command-controls" aria-label="Simulation controls" aria-busy={busy}>
        <span title={simRunning ? "the simulation is already running" : undefined}>
          <Button
            className="workspace-resume-button"
            startIcon={<PlayIcon />}
            onClick={onResume}
            disabled={busy || simRunning}
          >
            {busy ? "Working…" : simRunning ? "Running" : "Start"}
          </Button>
        </span>
        <span title="Pause is not available yet">
          <button type="button" className="workspace-command-button" disabled>
            Pause
          </button>
        </span>
        <button
          type="button"
          className="workspace-command-button workspace-stop-button"
          onClick={onStop}
          disabled={busy}
          title="stops gz-server, gz-gui, xrce-agent and px4"
        >
          Stop
        </button>
      </div>

      <div className="workspace-top-status" aria-label="Simulation status">
        <StatusIndicator
          label={gazeboUp ? "Gazebo Connected" : "Gazebo Disconnected"}
          active={gazeboUp}
        />
        <StatusIndicator
          label={px4Up ? "PX4 SITL Active" : "PX4 SITL Inactive"}
          active={px4Up}
        />
      </div>
    </header>
  );
}
