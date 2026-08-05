import {
  GraphLayoutToggle,
  type GraphLayout,
} from "./GraphLayoutToggle";
import "./graph-filter.css";

export type GraphVisibility = "active" | "all";

interface GraphStatusFilterProps {
  value: GraphVisibility;
  onChange: (visibility: GraphVisibility) => void;
}

export function GraphStatusFilter({ value, onChange }: GraphStatusFilterProps) {
  return (
    <label className="graph-status-filter">
      <span className="visually-hidden">Service visibility</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as GraphVisibility)}
      >
        <option value="active">Active Only</option>
        <option value="all">All Services</option>
      </select>
    </label>
  );
}

interface GraphSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function GraphSearchInput({ value, onChange }: GraphSearchInputProps) {
  return (
    <label className="graph-filter-search">
      <span className="visually-hidden">Search graph</span>
      <span className="graph-filter-search-icon" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search services, interfaces…"
      />
    </label>
  );
}

interface GraphRefreshButtonProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function GraphRefreshButton({
  isRefreshing,
  onRefresh,
}: GraphRefreshButtonProps) {
  return (
    <button
      className="graph-filter-refresh"
      type="button"
      aria-label={isRefreshing ? "Refreshing graph" : "Refresh graph"}
      title={isRefreshing ? "Refreshing graph" : "Refresh graph"}
      disabled={isRefreshing}
      onClick={onRefresh}
    >
      <span className={isRefreshing ? "is-refreshing" : undefined} aria-hidden="true">
        ↻
      </span>
    </button>
  );
}

interface GraphFilterBarProps {
  visibility: GraphVisibility;
  onVisibilityChange: (visibility: GraphVisibility) => void;
  search: string;
  onSearchChange: (value: string) => void;
  layout: GraphLayout;
  onLayoutChange: (layout: GraphLayout) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function GraphFilterBar({
  visibility,
  onVisibilityChange,
  search,
  onSearchChange,
  layout,
  onLayoutChange,
  isRefreshing,
  onRefresh,
}: GraphFilterBarProps) {
  return (
    <div className="graph-filter-bar" aria-label="Graph filters and layout">
      <div className="graph-filter-primary">
        <GraphStatusFilter value={visibility} onChange={onVisibilityChange} />
        <GraphSearchInput value={search} onChange={onSearchChange} />
      </div>
      <div className="graph-filter-actions">
        <GraphLayoutToggle value={layout} onChange={onLayoutChange} />
        <GraphRefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
