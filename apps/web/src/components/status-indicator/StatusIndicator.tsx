import "./status-indicator.css";

interface StatusIndicatorProps {
  label: string;
  isRefreshing?: boolean;
}

export function StatusIndicator({ label, isRefreshing = false }: StatusIndicatorProps) {
  return (
    <span className="status-indicator">
      <i className={isRefreshing ? "is-refreshing" : undefined} aria-hidden="true" />
      {label}
    </span>
  );
}
