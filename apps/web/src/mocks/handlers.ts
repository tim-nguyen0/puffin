import { http, HttpResponse } from "msw";
import type { components } from "@puffin/api-types";

type Schemas = components["schemas"];

/* One fixture per contract endpoint; shapes are compile-checked against
   packages/api-types, so contract drift fails `pnpm typecheck` here. */

const ack: Schemas["Ack"] = { ok: true, detail: "mock" };

const processes: Schemas["ProcessInfo"][] = [
  { name: "gz-server", state: "RUNNING", uptime_s: 512 },
  { name: "gz-gui", state: "RUNNING", uptime_s: 510 },
  { name: "xrce-agent", state: "RUNNING", uptime_s: 509 },
  { name: "px4", state: "RUNNING", uptime_s: 507 },
];

const rosServices = [
  { name: "/camera_node/get_parameters", type: "rcl_interfaces/srv/GetParameters" },
  { name: "/camera_node/set_parameters", type: "rcl_interfaces/srv/SetParameters" },
  { name: "/controller_manager/list_controllers", type: "controller_manager_msgs/srv/ListControllers" },
  { name: "/controller_manager/switch_controller", type: "controller_manager_msgs/srv/SwitchController" },
  { name: "/lidar_node/get_parameters", type: "rcl_interfaces/srv/GetParameters" },
  { name: "/offboard_control/change_state", type: "lifecycle_msgs/srv/ChangeState" },
  { name: "/offboard_control/get_state", type: "lifecycle_msgs/srv/GetState" },
  { name: "/px4/reset_vehicle", type: "px4_msgs/srv/VehicleCommand" },
  { name: "/ros_gz_bridge/get_parameters", type: "rcl_interfaces/srv/GetParameters" },
  { name: "/ros_gz_bridge/set_parameters", type: "rcl_interfaces/srv/SetParameters" },
  { name: "/waypoint_follower/clear_path", type: "puffin_msgs/srv/ClearPath" },
  { name: "/waypoint_follower/set_path", type: "puffin_msgs/srv/SetPath" },
] satisfies Schemas["RosService"][];

export const handlers = [
  http.get("/api/health", () =>
    HttpResponse.json({ status: "ok", version: "0.1.0" } satisfies Schemas["Health"]),
  ),
  http.get("/api/sim/status", () =>
    HttpResponse.json({
      running: true,
      world: "puffin",
      processes,
    } satisfies Schemas["SimStatus"]),
  ),
  http.post("/api/sim/start", () => HttpResponse.json(ack)),
  http.post("/api/sim/stop", () => HttpResponse.json(ack)),
  http.post("/api/sim/reset", () => HttpResponse.json(ack)),
  http.post("/api/sim/vehicle/pose", () => HttpResponse.json(ack)),
  http.get("/api/procs", () => HttpResponse.json(processes)),
  http.post("/api/vehicle/arm", () => HttpResponse.json(ack)),
  http.post("/api/vehicle/disarm", () => HttpResponse.json(ack)),
  http.post("/api/vehicle/takeoff", () => HttpResponse.json(ack)),
  http.post("/api/vehicle/land", () => HttpResponse.json(ack)),
  http.get("/api/ros/services", () => HttpResponse.json(rosServices)),
  http.get("/api/ros/graph", () =>
    HttpResponse.json({
      nodes: ["/puffin_api", "/offboard_demo"],
      topics: [{ name: "/fmu/out/vehicle_status_v1", type: "px4_msgs/msg/VehicleStatus" }],
    } satisfies Schemas["RosGraph"]),
  ),
  http.get("/api/ros/lifecycle/:nodeName", ({ params }) =>
    HttpResponse.json({
      node: String(params.nodeName),
      state: "inactive",
    } satisfies Schemas["LifecycleState"]),
  ),
  http.post("/api/ros/lifecycle/:nodeName/transition", () => HttpResponse.json(ack)),
];
