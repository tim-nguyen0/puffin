import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { WorkspaceHeader } from "../workspace-header";

const SCREEN_LABELS: Record<string, string> = {
  "/": "Launcher",
  "/dashboard": "Dashboard",
  "/dashboard/console": "Console",
  "/simulation": "Simulation",
  "/vehicles": "Vehicle Library",
  "/sensors": "Sensors",
  "/ros-services": "ROS Nodes",
  "/ros-graph": "ROS2 Graph",
  "/settings": "Settings",
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
    <WorkspaceHeader
      pageLabel={SCREEN_LABELS[location.pathname] ?? "Puffin"}
      onResume={() => start.mutate()}
      onStop={() => stop.mutate()}
      busy={start.isPending || stop.isPending}
      gazeboUp={gazeboUp}
      px4Up={px4Up}
      simRunning={status?.running ?? false}
    />
  );
}
