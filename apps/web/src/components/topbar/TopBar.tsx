import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import "./topbar.css";

const SCREEN_LABELS: Record<string, string> = {
  "/": "Launcher",
  "/dashboard": "Simulation",
  "/ros-services": "ROS Nodes",
  "/ros-graph": "ROS2 Graph",
};

export function TopBar() {
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["sim-status"],
    queryFn: async () => (await api.GET("/sim/status")).data,
    refetchInterval: 5000,
  });

  const invalidateStatus = () =>
    queryClient.invalidateQueries({ queryKey: ["sim-status"] });
  const start = useMutation({
    mutationFn: async () => (await api.POST("/sim/start")).data,
    onSettled: invalidateStatus,
  });
  const stop = useMutation({
    mutationFn: async () => (await api.POST("/sim/stop")).data,
    onSettled: invalidateStatus,
  });

  const procs = new Map((status?.processes ?? []).map((p) => [p.name, p.state]));
  const gazeboUp = procs.get("gz-server") === "RUNNING";
  const px4Up = procs.get("px4") === "RUNNING";

  return (
    <header className="topbar">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <span className="breadcrumb-workspace">rospackage-4</span>
        <span className="breadcrumb-sep" aria-hidden="true">
          ›
        </span>
        <span className="breadcrumb-screen">
          {SCREEN_LABELS[location.pathname] ?? "Puffin"}
        </span>
      </nav>
      <div className="sim-controls">
        <button
          type="button"
          className="sim-resume"
          onClick={() => start.mutate()}
          disabled={start.isPending}
        >
          Resume
        </button>
        <button type="button" className="sim-small-btn" title="Pause is not available yet" disabled>
          Pause
        </button>
        <button
          type="button"
          className="sim-small-btn"
          onClick={() => stop.mutate()}
          disabled={stop.isPending}
        >
          Stop
        </button>
      </div>
      <div className="status-indicators">
        <span className="status-item">
          <span className={`status-dot ${gazeboUp ? "is-ok" : "is-down"}`} />
          {gazeboUp ? "Gazebo Connected" : "Gazebo Disconnected"}
        </span>
        <span className="status-item">
          <span className={`status-dot ${px4Up ? "is-ok" : "is-down"}`} />
          {px4Up ? "PX4 SITL Active" : "PX4 SITL Inactive"}
        </span>
      </div>
    </header>
  );
}
