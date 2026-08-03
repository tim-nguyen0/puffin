import type { ReactNode } from "react";
import "./dashboard-panel.css";

interface DashboardPanelProps {
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  icon?: ReactNode;
  title: string;
}

export function DashboardPanel({
  children,
  className = "",
  headerAction,
  icon,
  title,
}: DashboardPanelProps) {
  return (
    <section className={`dashboard-panel ${className}`.trim()}>
      <header className="dashboard-panel-header">
        <h2>
          {icon ? <span className="dashboard-panel-icon">{icon}</span> : null}
          {title}
        </h2>
        {headerAction}
      </header>
      <div className="dashboard-panel-body">{children}</div>
    </section>
  );
}
