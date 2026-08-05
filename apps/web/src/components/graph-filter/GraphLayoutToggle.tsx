export type GraphLayout = "hierarchical" | "force-directed";

interface GraphLayoutToggleProps {
  value: GraphLayout;
  onChange: (layout: GraphLayout) => void;
}

const LAYOUT_OPTIONS: { label: string; value: GraphLayout }[] = [
  { label: "Hierarchical", value: "hierarchical" },
  { label: "Force-Directed", value: "force-directed" },
];

export function GraphLayoutToggle({ value, onChange }: GraphLayoutToggleProps) {
  return (
    <div className="graph-layout-toggle" role="group" aria-label="Graph layout">
      {LAYOUT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "is-active" : undefined}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
