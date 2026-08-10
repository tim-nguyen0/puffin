import type { components } from "@puffin/api-types";
import type { LifecycleStateName } from "../../components/lifecycle";
import type { StatusTone } from "../../components/status-tag";

export type Waypoint = components["schemas"]["Waypoint"];
export type MissionStatus = components["schemas"]["MissionStatus"];

// the plan as the editor holds it right now - compared against the last
// snapshot that was actually launched, so we can flag drift instead of
// silently flying a stale plan
export interface FlightPlan {
  waypoints: Waypoint[];
  rateHz: number;
  takeoffZ: number;
  returnToOrigin: boolean;
}

export function plansMatch(a: FlightPlan, b: FlightPlan): boolean {
  return (
    a.rateHz === b.rateHz &&
    a.takeoffZ === b.takeoffZ &&
    a.returnToOrigin === b.returnToOrigin &&
    a.waypoints.length === b.waypoints.length &&
    a.waypoints.every((wp, i) => {
      const other = b.waypoints[i];
      return wp.x === other.x && wp.y === other.y && wp.z === other.z && (wp.hold_s ?? 0) === (other.hold_s ?? 0);
    })
  );
}

export interface FlightStatus {
  label: string;
  tone: StatusTone;
}

// one verb, one dedicated executor: jargon-free copy for the header tag.
// unconfigured (never primed) reads the same as inactive (armed) - both
// just mean "not flying yet" from the pilot's chair. anything else
// (unknown/finalized, or no state fetched yet) means the node can't be
// reached.
export function flightStatus(state: LifecycleStateName | undefined): FlightStatus {
  if (state === "active") return { label: "flying", tone: "running" };
  if (state === "inactive" || state === "unconfigured") return { label: "ready", tone: "armed" };
  return { label: "offline", tone: "stopped" };
}

// planning-screen estimate only; px4's actual cruise depends on tuning
export const CRUISE_M_S = 2.0;

interface PathPoint {
  x: number;
  y: number;
  z: number;
}

// the full flown path: climb from the pad, walk waypoints, optional return
export function missionPath(
  waypoints: Waypoint[],
  takeoffZ: number,
  returnToOrigin: boolean,
): PathPoint[] {
  const path: PathPoint[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: takeoffZ },
    ...waypoints.map((wp) => ({ x: wp.x, y: wp.y, z: wp.z })),
  ];
  if (returnToOrigin) path.push({ x: 0, y: 0, z: takeoffZ });
  return path;
}

export function totalDistance(
  waypoints: Waypoint[],
  takeoffZ: number,
  returnToOrigin: boolean,
): number {
  const path = missionPath(waypoints, takeoffZ, returnToOrigin);
  let sum = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    sum += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return sum;
}

export function flightTimeS(
  waypoints: Waypoint[],
  takeoffZ: number,
  returnToOrigin: boolean,
): number {
  const holds = waypoints.reduce((acc, wp) => acc + (wp.hold_s ?? 0), 0);
  return totalDistance(waypoints, takeoffZ, returnToOrigin) / CRUISE_M_S + holds;
}

export function maxAltitudeM(waypoints: Waypoint[], takeoffZ: number): number {
  // ned z is down; altitude is -z
  return Math.max(-takeoffZ, ...waypoints.map((wp) => -wp.z)) + 0;
}

export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return minutes > 0 ? `${minutes}min ${whole % 60}s` : `${whole}s`;
}

export type RowTone = "reached" | "active" | "pending";

// map the executor's status onto a waypoint row for the builder list
export function rowTone(index: number, status: MissionStatus | undefined): RowTone {
  if (!status) return "pending";
  if (status.state === "done" || status.state === "returning") return "reached";
  if (status.state !== "flying" && status.state !== "holding") return "pending";
  const current = status.current_index;
  if (current == null) return "pending"; // climbing out, no waypoint yet
  if (index < current) return "reached";
  if (index === current) return "active";
  return "pending";
}

export interface PreflightCheck {
  label: string;
  ok: boolean;
  detail: string;
}

// the planner only ever flies the one dedicated executor - the mission host
// births/rebuilds it under this name every time the current plan launches
export const EXECUTOR_NAME = "mission_planner";

export function preflightChecks(
  waypoints: Waypoint[],
  takeoffZ: number,
  telemetryLive: boolean,
  executorState: LifecycleStateName | undefined,
): PreflightCheck[] {
  const aboveGround = waypoints.every((wp) => wp.z <= -1);
  const executorOk =
    executorState === "active" || executorState === "inactive" || executorState === "unconfigured";
  return [
    {
      label: "telemetry",
      ok: telemetryLive,
      detail: telemetryLive ? "socket live" : "no samples - is the sim running?",
    },
    {
      label: "waypoints",
      ok: waypoints.length > 0,
      detail: waypoints.length > 0 ? `${waypoints.length} planned` : "plan is empty",
    },
    {
      label: "altitudes",
      ok: aboveGround && takeoffZ <= -1,
      detail:
        aboveGround && takeoffZ <= -1
          ? "all above ground (ned z is down)"
          : "a z is at/below ground - the executor will refuse it",
    },
    {
      label: "executor",
      ok: executorOk,
      detail: executorOk
        ? `${EXECUTOR_NAME} ${executorState}`
        : `${EXECUTOR_NAME} not reachable`,
    },
  ];
}
