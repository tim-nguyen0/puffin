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
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <nav className="workspace-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>{packageName}</li>
          <li aria-current="page">{pageLabel}</li>
        </ol>
      </nav>

      <div className="workspace-command-controls" aria-label="Simulation controls">
        <Button
          className="workspace-resume-button"
          startIcon={<PlayIcon />}
          onClick={onResume}
          disabled={busy}
        >
          Resume
        </Button>
        <button
          type="button"
          className="workspace-command-button"
          aria-label="Pause simulation"
          title="Pause is not available yet"
          disabled
        >
          <span aria-hidden="true">Ⅱ</span>
        </button>
        <button
          type="button"
          className="workspace-command-button workspace-stop-button"
          aria-label="Stop simulation"
          onClick={onStop}
          disabled={busy}
        >
          <span aria-hidden="true">■</span>
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
