import "./metric-card.css";

interface MetricCardProps {
  accent?: "blue" | "cyan" | "green";
  label: string;
  mono?: boolean;
  showIndicator?: boolean;
  tone?: "dark" | "light";
  value: string;
  valueAccent?: "blue" | "green";
}

export function MetricCard({
  accent = "blue",
  label,
  mono = false,
  showIndicator = true,
  tone = "light",
  value,
  valueAccent,
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      <header>
        <span>{label}</span>
        {showIndicator ? (
          <i className={`metric-card-dot metric-card-dot-${accent}`} aria-hidden="true" />
        ) : null}
      </header>
      <strong
        className={[
          mono ? "is-mono" : "",
          valueAccent ? `metric-card-value-${valueAccent}` : "",
        ].filter(Boolean).join(" ")}
      >
        {value}
      </strong>
    </article>
  );
}
