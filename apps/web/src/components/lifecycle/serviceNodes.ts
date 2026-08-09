import type { StatusTone } from "../status-tag";

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
