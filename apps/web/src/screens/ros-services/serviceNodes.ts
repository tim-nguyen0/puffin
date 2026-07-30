import type { StatusTone } from "../../components/status-tag";

export type ServiceNodeKind = "launch" | "lifecycle" | "node" | "rosbag";
export type ServiceNodeAction = "arm" | "run" | "stop";

export interface ServiceNode {
  description: string;
  details: {
    executable: string;
    package: string;
    publishes: string;
    subscribes: string;
  };
  kind: ServiceNodeKind;
  name: string;
  status: StatusTone;
}

export const INITIAL_SERVICE_NODES: ServiceNode[] = [
  {
    name: "bringup.launch.py",
    kind: "launch",
    status: "running",
    description: "launch file · full autonomy stack",
    details: {
      package: "puffin_autonomy",
      executable: "bringup.launch.py",
      publishes: "autonomy stack",
      subscribes: "launch arguments",
    },
  },
  {
    name: "offboard_control",
    kind: "lifecycle",
    status: "running",
    description: "lifecycle node · trajectory setpoint streamer",
    details: {
      package: "puffin_autonomy",
      executable: "offboard_control",
      publishes: "/fmu/in/trajectory_setpoint",
      subscribes: "/fmu/out/vehicle_local_position",
    },
  },
  {
    name: "sensor_bridge",
    kind: "node",
    status: "running",
    description: "ros_gz_bridge · camera / lidar / imu → topics",
    details: {
      package: "ros_gz_bridge",
      executable: "parameter_bridge",
      publishes: "/camera · /lidar · /imu",
      subscribes: "Gazebo transport",
    },
  },
  {
    name: "waypoint_follower",
    kind: "lifecycle",
    status: "armed",
    description: "lifecycle node · NED path executor",
    details: {
      package: "puffin_autonomy",
      executable: "waypoint_follower",
      publishes: "/fmu/in/trajectory_setpoint",
      subscribes: "/mission/waypoints",
    },
  },
  {
    name: "safety_monitor",
    kind: "node",
    status: "armed",
    description: "node · geofence + failsafe watchdog",
    details: {
      package: "puffin_safety",
      executable: "safety_monitor",
      publishes: "/puffin/failsafe",
      subscribes: "/fmu/out/vehicle_status",
    },
  },
  {
    name: "mission_recorder",
    kind: "rosbag",
    status: "stopped",
    description: "rosbag2 · flight data logger",
    details: {
      package: "rosbag2_transport",
      executable: "record",
      publishes: "—",
      subscribes: "/fmu/out/*",
    },
  },
  {
    name: "vision_landing",
    kind: "lifecycle",
    status: "stopped",
    description: "lifecycle node · precision land (VIO)",
    details: {
      package: "puffin_vision",
      executable: "vision_landing",
      publishes: "/fmu/in/vehicle_visual_odometry",
      subscribes: "/camera/image_raw",
    },
  },
];

export function transitionServiceNode(
  nodes: ServiceNode[],
  nodeName: string,
  action: ServiceNodeAction,
): ServiceNode[] {
  const nextStatus: StatusTone =
    action === "arm" ? "armed" : action === "run" ? "running" : "stopped";

  return nodes.map((node) =>
    node.name === nodeName ? { ...node, status: nextStatus } : node,
  );
}

export function countServiceStates(nodes: ServiceNode[]) {
  return nodes.reduce(
    (counts, node) => {
      counts[node.status] += 1;
      return counts;
    },
    { armed: 0, running: 0, stopped: 0 },
  );
}
