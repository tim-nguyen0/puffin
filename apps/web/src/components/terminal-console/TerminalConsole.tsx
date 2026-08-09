import type { ReactNode } from "react";
import { DashboardPanel } from "../dashboard-panel";
import "./terminal-console.css";

interface TerminalTab {
  label: string;
  value: string;
}

interface TerminalConsoleProps {
  activeTab?: string;
  className?: string;
  lines: ReactNode[];
  prompt: ReactNode;
  statusLabel?: string;
  tabs?: TerminalTab[];
  title?: string;
}

const DEFAULT_TABS: TerminalTab[] = [
  { label: "docker compose", value: "compose" },
  { label: "px4 pxh", value: "px4" },
  { label: "ros2", value: "ros2" },
  { label: "gazebo", value: "gazebo" },
];

export function TerminalConsole({
  activeTab = "compose",
  className = "",
  lines,
  prompt,
  statusLabel = "● running",
  tabs = DEFAULT_TABS,
  title = "〉_ Terminal",
}: TerminalConsoleProps) {
  return (
    <DashboardPanel
      className={`terminal-console ${className}`.trim()}
      title={title}
      headerAction={
        <div className="terminal-console-tabs" aria-label="Terminal tabs">
          {tabs.map((tab) =>
            tab.value === activeTab ? (
              <b key={tab.value}>{tab.label}</b>
            ) : (
              <span key={tab.value}>{tab.label}</span>
            ),
          )}
          <em>{statusLabel}</em>
        </div>
      }
    >
      <div className="terminal-console-output">
        <code>
          {lines.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
          <span className="terminal-console-prompt">{prompt}</span>
        </code>
      </div>
    </DashboardPanel>
  );
}
