import { Button } from "../button";
import { StatusIndicator } from "../status-indicator";
import "./workspace-header.css";

interface WorkspaceHeaderProps {
  pageLabel: string;
  packageName?: string;
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
        <Button className="workspace-resume-button" startIcon={<PlayIcon />}>
          Resume
        </Button>
        <button
          type="button"
          className="workspace-command-button"
          aria-label="Pause simulation"
        >
          <span aria-hidden="true">Ⅱ</span>
        </button>
        <button
          type="button"
          className="workspace-command-button workspace-stop-button"
          aria-label="Stop simulation"
        >
          <span aria-hidden="true">■</span>
        </button>
      </div>

      <div className="workspace-top-status" aria-label="Simulation status">
        <StatusIndicator label="Gazebo Connected" />
        <StatusIndicator label="PX4 SITL Active" />
      </div>
    </header>
  );
}
