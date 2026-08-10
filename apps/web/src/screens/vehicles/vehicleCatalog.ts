import type { components } from "@puffin/api-types";

type RosGraph = components["schemas"]["RosGraph"];

// what px4 boots with before anything replaces it; only a fallback for
// before /sim/status answers - the live model comes from SimStatus.vehicle
export const DEFAULT_SPAWNED_MODEL = "x500";

export type VehicleStatus = "spawned" | "available" | "not-installed";

export interface VehicleSensors {
  camera: boolean;
  lidar: boolean;
  gps: boolean;
}

export interface Vehicle {
  model: string; // gz model name, unique id
  name: string;
  category: string;
  // SYS_AUTOSTART id of the airframe baked into the image; null = not shipped
  // in our PX4 ref (verified against init.d-posix/airframes)
  airframe: number | null;
  sensors: VehicleSensors;
  specs: Array<[string, string]>;
  // topics the vehicle serves once px4 attaches; shown until the live graph
  // can answer instead
  expectedTopics: string[];
}

const FMU_TOPICS = [
  "/fmu/out/vehicle_status_v1",
  "/fmu/out/vehicle_odometry",
  "/fmu/out/battery_status",
  "/fmu/in/vehicle_command",
  "/fmu/in/offboard_control_mode",
  "/fmu/in/trajectory_setpoint",
];

export const VEHICLES: Vehicle[] = [
  {
    model: "x500",
    name: "X500 Quadcopter",
    category: "Quadcopter",
    airframe: 4001,
    sensors: { camera: false, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Quadcopter X"],
      ["Motor Count", "4 motors"],
      ["Sensors", "IMU · GPS · baro · mag"],
      ["Takeoff Weight", "~2.0 kg"],
      ["Role", "default puffin vehicle"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "x500_depth",
    name: "X500 Depth",
    category: "Quadcopter",
    airframe: 4002,
    sensors: { camera: true, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Quadcopter X"],
      ["Motor Count", "4 motors"],
      ["Sensors", "IMU · GPS · depth camera"],
      ["Camera", "OAK-D stereo depth"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "x500_vision",
    name: "X500 Vision",
    category: "Quadcopter",
    airframe: 4005,
    sensors: { camera: true, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Quadcopter X"],
      ["Motor Count", "4 motors"],
      ["Sensors", "IMU · GPS · vision odometry"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "x500_mono_cam",
    name: "X500 Mono Cam",
    category: "Quadcopter",
    airframe: 4010,
    sensors: { camera: true, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Quadcopter X"],
      ["Motor Count", "4 motors"],
      ["Sensors", "IMU · GPS · mono camera"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "standard_vtol",
    name: "Standard VTOL",
    category: "Standard VTOL",
    airframe: 4004,
    sensors: { camera: false, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Quad + pusher VTOL"],
      ["Motor Count", "5 motors"],
      ["Sensors", "IMU · GPS · airspeed"],
      ["Transition", "hover ↔ fixed-wing"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "rc_cessna",
    name: "RC Cessna",
    category: "Fixed-wing",
    airframe: 4003,
    sensors: { camera: false, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Fixed-wing"],
      ["Motor Count", "1 motor"],
      ["Sensors", "IMU · GPS · airspeed"],
      ["Launch", "runway takeoff"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "advanced_plane",
    name: "Advanced Plane",
    category: "Fixed-wing",
    airframe: 4008,
    sensors: { camera: false, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Fixed-wing"],
      ["Motor Count", "1 motor"],
      ["Sensors", "IMU · GPS · airspeed"],
      ["Aero", "advanced lift/drag model"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "px4vision",
    name: "PX4 Vision",
    category: "Quadcopter",
    airframe: 4006,
    sensors: { camera: true, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Quadcopter X"],
      ["Motor Count", "4 motors"],
      ["Sensors", "IMU · GPS · depth camera"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "omnicopter",
    name: "Omnicopter",
    category: "Multirotor",
    airframe: 8011,
    sensors: { camera: false, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Omnidirectional"],
      ["Motor Count", "8 motors"],
      ["Sensors", "IMU · GPS"],
      ["Control", "6-DOF thrust vectoring"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "r1_rover",
    name: "R1 Rover",
    category: "Rover",
    airframe: 4009,
    sensors: { camera: false, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Differential drive"],
      ["Motor Count", "2 motors"],
      ["Sensors", "IMU · GPS"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "quadtailsitter",
    name: "Quad Tailsitter",
    category: "Tailsitter VTOL",
    airframe: null,
    sensors: { camera: false, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Quad tailsitter"],
      ["Motor Count", "4 motors"],
      ["Availability", "newer px4 release"],
    ],
    expectedTopics: FMU_TOPICS,
  },
  {
    model: "tiltrotor",
    name: "Tiltrotor",
    category: "Tiltrotor VTOL",
    airframe: null,
    sensors: { camera: false, lidar: false, gps: true },
    specs: [
      ["Frame Type", "Tiltrotor VTOL"],
      ["Motor Count", "4 motors"],
      ["Availability", "newer px4 release"],
    ],
    expectedTopics: FMU_TOPICS,
  },
];

export function statusFor(
  vehicle: Vehicle,
  telemetryLive: boolean,
  spawnedModel: string,
): VehicleStatus {
  if (vehicle.airframe === null) return "not-installed";
  if (vehicle.model === spawnedModel && telemetryLive) return "spawned";
  return "available";
}

export function searchVehicles(vehicles: Vehicle[], query: string): Vehicle[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return vehicles;
  return vehicles.filter((v) =>
    [v.name, v.model, v.category].some((field) => field.toLowerCase().includes(needle)),
  );
}

// live /fmu topic names from the ros graph, px4 -> ros first
export function fmuTopics(graph: RosGraph | undefined): { published: string[]; subscribed: string[] } {
  const names = (graph?.topics ?? []).map((t) => t.name);
  return {
    published: names.filter((n) => n.startsWith("/fmu/out/")).sort(),
    subscribed: names.filter((n) => n.startsWith("/fmu/in/")).sort(),
  };
}
