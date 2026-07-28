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
  http.get("/api/procs", () => HttpResponse.json(processes)),
  http.post("/api/vehicle/arm", () => HttpResponse.json(ack)),
  http.post("/api/vehicle/disarm", () => HttpResponse.json(ack)),
  http.post("/api/vehicle/takeoff", () => HttpResponse.json(ack)),
  http.post("/api/vehicle/land", () => HttpResponse.json(ack)),
  http.get("/api/ros/services", () =>
    HttpResponse.json([
      { name: "/offboard_demo/change_state", type: "lifecycle_msgs/srv/ChangeState" },
    ] satisfies Schemas["RosService"][]),
  ),
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
