import "./status-tag.css";

export type StatusTone = "armed" | "running" | "stopped";

interface StatusTagProps {
  label?: string;
  showDot?: boolean;
  status: StatusTone;
}

export function StatusTag({
  label,
  showDot = true,
  status,
}: StatusTagProps) {
  return (
    <span className={`status-tag status-tag-${status}`}>
      {showDot ? <i aria-hidden="true" /> : null}
      {label ?? status}
    </span>
  );
}
