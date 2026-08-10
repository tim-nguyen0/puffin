import type { components } from "@puffin/api-types";
import type { StatusTone } from "../status-tag";

type ProcessInfo = components["schemas"]["ProcessInfo"];

// the design's three states map cleanly onto the ros 2 lifecycle:
// stopped = unconfigured/finalized, armed = inactive (configured),
// running = active
export type LifecycleStateName =
  | "unconfigured"
  | "inactive"
  | "active"
  | "finalized"
  | "unknown";

export type ServiceNodeAction = "arm" | "run" | "stop";
export type TransitionName = "configure" | "activate" | "deactivate" | "cleanup";

export function toneForState(state: LifecycleStateName | undefined): StatusTone {
  if (state === "active") return "running";
  if (state === "inactive") return "armed";
  return "stopped";
}

export function actionsForState(
  state: LifecycleStateName | undefined,
): ServiceNodeAction[] {
  if (state === "active") return ["stop"];
  if (state === "inactive") return ["run", "stop"];
  if (state === "unconfigured") return ["arm"];
  return [];
}

// arm = configure, run = activate, stop = deactivate when running and
// cleanup when armed - always one legal transition per button
export function transitionForAction(
  action: ServiceNodeAction,
  state: LifecycleStateName | undefined,
): TransitionName | null {
  if (action === "arm" && state === "unconfigured") return "configure";
  if (action === "run" && state === "inactive") return "activate";
  if (action === "stop" && state === "active") return "deactivate";
  if (action === "stop" && state === "inactive") return "cleanup";
  return null;
}

export interface ReplayTarget {
  // supervisord program name. a forged node's package, executable, program
  // and node name are all the same string, so the bare node name is it.
  program: string;
  // exit 0 is the forge template's "flight finished"; anything else stopped
  // it some other way and shouldn't be dressed up as success
  completed: boolean;
}

// a forged mission node is a one-shot: it exits when the flight is done and
// its lifecycle services go with it, leaving a card that reads unknown with
// no transition to offer. the supervised program of the same name outlives
// the node, so starting it again is the way to fly it a second time.
export function replayTarget(
  nodeName: string,
  nodeDown: boolean,
  processes: readonly ProcessInfo[],
): ReplayTarget | null {
  if (!nodeDown) return null;
  const program = nodeName.replace(/^\//, "");
  const proc = processes.find((entry) => entry.name === program);
  // STARTING is already on its way back up - offering replay would queue a
  // second start against a process that is about to answer for itself
  if (!proc || proc.state === "RUNNING" || proc.state === "STARTING") return null;
  return { program, completed: proc.state === "EXITED" };
}

export interface ServiceNodeMeta {
  description: string;
  package: string;
  executable: string;
  publishes: string;
  subscribes: string;
}

// what the api cannot introspect; known nodes get real metadata, the
// rest fall back to a generic lifecycle description
const KNOWN_NODES: Record<string, ServiceNodeMeta> = {
  "/offboard_demo": {
    description: "lifecycle node · 10 m square via offboard setpoints",
    package: "offboard_demo",
    executable: "offboard_demo_node",
    publishes: "/fmu/in/trajectory_setpoint",
    subscribes: "/fmu/out/vehicle_local_position",
  },
  "/teleop": {
    description: "lifecycle node · manual velocity flight with deadman",
    package: "offboard_demo",
    executable: "teleop_node",
    publishes: "/fmu/in/trajectory_setpoint",
    subscribes: "/puffin/teleop/cmd_vel",
  },
};

export function metaForNode(name: string): ServiceNodeMeta {
  return (
    KNOWN_NODES[name] ?? {
      description: "ros 2 lifecycle node",
      package: "—",
      executable: "—",
      publishes: "—",
      subscribes: "—",
    }
  );
}

// forged nodes (POST /mission/forge) are runtime-built packages named after
// themselves: package, executable, and node name are all the same string,
// and the plan they fly is baked into the build rather than subscribed to
export function forgedNodeMeta(name: string): ServiceNodeMeta {
  const bare = name.replace(/^\//, "");
  return {
    description: "forged mission node · flies its baked-in plan",
    package: bare,
    executable: bare,
    publishes: "/puffin/mission/status",
    subscribes: "—",
  };
}
