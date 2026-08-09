import { http, HttpResponse } from "msw";
import type { components } from "@puffin/api-types";

type Schemas = components["schemas"];

// lifecycle mock is stateful so the ui responds to transitions in dev
const TRANSITION_RESULTS: Record<string, Schemas["LifecycleState"]["state"]> = {
  configure: "inactive",
  activate: "active",
  deactivate: "inactive",
  cleanup: "unconfigured",
  shutdown: "finalized",
};
const lifecycleStates = new Map<string, Schemas["LifecycleState"]["state"]>();

/* One fixture per contract endpoint; shapes are compile-checked against
   packages/api-types, so contract drift fails `pnpm typecheck` here. */

const ack: Schemas["Ack"] = { ok: true, detail: "mock" };

let mockMission: Schemas["MissionRequest"] | null = null;

const processes: Schemas["ProcessInfo"][] = [
  { name: "gz-server", state: "RUNNING", uptime_s: 512 },
  { name: "gz-gui", state: "RUNNING", uptime_s: 510 },
  { name: "xrce-agent", state: "RUNNING", uptime_s: 509 },
  { name: "px4", state: "RUNNING", uptime_s: 507 },
];

type MockAccount = {
  user: Schemas["User"];
  password: string;
  settings: Schemas["UserSettings"];
};

const MOCK_STATE_KEY = "puffin-mock-auth";

function loadMockState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(MOCK_STATE_KEY) ?? "{}") as {
      accounts?: [string, MockAccount][];
      tokens?: [string, string][];
    };
    return {
      accounts: new Map(saved.accounts ?? []),
      tokens: new Map(saved.tokens ?? []),
    };
  } catch {
    return {
      accounts: new Map<string, MockAccount>(),
      tokens: new Map<string, string>(),
    };
  }
}

const mockState = loadMockState();
const mockAccounts = mockState.accounts;
const mockTokens = mockState.tokens;

function saveMockState() {
  window.localStorage.setItem(MOCK_STATE_KEY, JSON.stringify({
    accounts: Array.from(mockAccounts.entries()),
    tokens: Array.from(mockTokens.entries()),
  }));
}

function emailForRequest(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return mockTokens.get(header.slice(7)) ?? null;
}

function unauthorized() {
  return HttpResponse.json({ detail: "Not authenticated" }, { status: 401 });
}

export const handlers = [
  http.post("/api/auth/signup", async ({ request }) => {
    const body = await request.json() as Schemas["SignupRequest"];
    const email = body.email.trim().toLowerCase();
    if (mockAccounts.has(email)) {
      return HttpResponse.json({ detail: "Account already exists" }, { status: 409 });
    }
    const user = { id: crypto.randomUUID(), email };
    const settings: Schemas["UserSettings"] = {
      units: "metric",
      telemetry_history_limit: 600,
      ws_url: "/ws/telemetry",
      api_base_url: "/api",
      terminal_x: 0,
      terminal_y: 0,
      terminal_minimized: false,
    };
    const token = crypto.randomUUID();
    mockAccounts.set(email, { user, password: body.password, settings });
    mockTokens.set(token, email);
    saveMockState();
    return HttpResponse.json({ token, user } satisfies Schemas["AuthResponse"], { status: 201 });
  }),
  http.post("/api/auth/login", async ({ request }) => {
    const body = await request.json() as Schemas["LoginRequest"];
    const email = body.email.trim().toLowerCase();
    const account = mockAccounts.get(email);
    if (!account || account.password !== body.password) {
      return HttpResponse.json({ detail: "Incorrect email or password" }, { status: 401 });
    }
    const token = crypto.randomUUID();
    mockTokens.set(token, email);
    saveMockState();
    return HttpResponse.json({ token, user: account.user } satisfies Schemas["AuthResponse"]);
  }),
  http.get("/api/auth/me", ({ request }) => {
    const email = emailForRequest(request);
    if (!email) return unauthorized();
    return HttpResponse.json(mockAccounts.get(email)!.user);
  }),
  http.post("/api/auth/logout", ({ request }) => {
    const header = request.headers.get("Authorization");
    if (!header?.startsWith("Bearer ")) return unauthorized();
    mockTokens.delete(header.slice(7));
    saveMockState();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/settings", ({ request }) => {
    const email = emailForRequest(request);
    if (!email) return unauthorized();
    return HttpResponse.json(mockAccounts.get(email)!.settings);
  }),
  http.put("/api/settings", async ({ request }) => {
    const email = emailForRequest(request);
    if (!email) return unauthorized();
    const settings = await request.json() as Schemas["UserSettings"];
    mockAccounts.get(email)!.settings = settings;
    saveMockState();
    return HttpResponse.json(settings);
  }),
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
  // mission mock: latch the plan, then pretend the executor walks it
  http.get("/api/mission", () =>
    HttpResponse.json({
      state: mockMission ? "ready" : "idle",
      current_index: null,
      total: mockMission?.waypoints.length ?? 0,
      detail: mockMission ? "latched; activate mission_node to fly" : "no mission latched",
    } satisfies Schemas["MissionStatus"]),
  ),
  http.post("/api/mission", async ({ request }) => {
    mockMission = (await request.json()) as Schemas["MissionRequest"];
    return HttpResponse.json(
      { ok: true, detail: `mission latched (${mockMission.waypoints.length} waypoints)` } satisfies Schemas["Ack"],
      { status: 202 },
    );
  }),
  http.get("/api/ros/services", () =>
    HttpResponse.json([
      { name: "/offboard_demo/change_state", type: "lifecycle_msgs/srv/ChangeState" },
      { name: "/teleop/change_state", type: "lifecycle_msgs/srv/ChangeState" },
      { name: "/mission_node/change_state", type: "lifecycle_msgs/srv/ChangeState" },
    ] satisfies Schemas["RosService"][]),
  ),
  http.get("/api/ros/graph", () =>
    HttpResponse.json({
      nodes: ["/puffin_api", "/offboard_demo", "/teleop", "/mission_node", "/px4_xrce_agent"],
      topics: [
        {
          name: "/fmu/out/vehicle_status_v1",
          type: "px4_msgs/msg/VehicleStatus",
          publishers: ["/px4_xrce_agent"],
          subscribers: ["/puffin_api"],
        },
        {
          name: "/fmu/out/vehicle_local_position_v1",
          type: "px4_msgs/msg/VehicleLocalPosition",
          publishers: ["/px4_xrce_agent"],
          subscribers: ["/puffin_api", "/offboard_demo"],
        },
        {
          name: "/fmu/in/trajectory_setpoint",
          type: "px4_msgs/msg/TrajectorySetpoint",
          publishers: ["/offboard_demo"],
          subscribers: ["/px4_xrce_agent"],
        },
        {
          name: "/fmu/in/vehicle_command",
          type: "px4_msgs/msg/VehicleCommand",
          publishers: ["/puffin_api", "/offboard_demo"],
          subscribers: ["/px4_xrce_agent"],
        },
        {
          name: "/puffin/mission",
          type: "std_msgs/msg/String",
          publishers: ["/puffin_api"],
          subscribers: ["/mission_node"],
        },
        {
          name: "/puffin/mission/status",
          type: "std_msgs/msg/String",
          publishers: ["/mission_node"],
          subscribers: ["/puffin_api"],
        },
      ],
    } satisfies Schemas["RosGraph"]),
  ),
  http.get("/api/ros/lifecycle/:nodeName", ({ params }) =>
    HttpResponse.json({
      node: String(params.nodeName),
      state: lifecycleStates.get(String(params.nodeName)) ?? "inactive",
    } satisfies Schemas["LifecycleState"]),
  ),
  http.post("/api/ros/lifecycle/:nodeName/transition", async ({ params, request }) => {
    const body = (await request.json()) as Schemas["TransitionRequest"];
    const next = TRANSITION_RESULTS[body.transition];
    if (next) lifecycleStates.set(String(params.nodeName), next);
    return HttpResponse.json(ack);
  }),
];
