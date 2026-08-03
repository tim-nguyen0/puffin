import "./status-indicator.css";

interface StatusIndicatorProps {
  label: string;
  active?: boolean;
  isRefreshing?: boolean;
}

export function StatusIndicator({
  label,
  active = true,
  isRefreshing = false,
}: StatusIndicatorProps) {
  const classes = [active ? "" : "is-down", isRefreshing ? "is-refreshing" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className="status-indicator">
      <i className={classes || undefined} aria-hidden="true" />
      {label}
    </span>
  );
}
