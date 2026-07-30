import "./metric-card.css";

interface MetricCardProps {
  accent?: "blue" | "cyan" | "green";
  label: string;
  mono?: boolean;
  value: string;
}

export function MetricCard({
  accent = "blue",
  label,
  mono = false,
  value,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <header>
        <span>{label}</span>
        <i className={`metric-card-dot metric-card-dot-${accent}`} aria-hidden="true" />
      </header>
      <strong className={mono ? "is-mono" : undefined}>{value}</strong>
    </article>
  );
}
