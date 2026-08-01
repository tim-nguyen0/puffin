import type { components } from "@puffin/api-types";

type RosService = components["schemas"]["RosService"];

// lifecycle nodes reveal themselves through their change_state service, so
// the existing /ros/services response is enough - no extra endpoint
export function lifecycleNodeNames(services: readonly RosService[]): string[] {
  const suffix = "/change_state";
  return services
    .filter(
      (svc) => svc.type === "lifecycle_msgs/srv/ChangeState" && svc.name.endsWith(suffix),
    )
    .map((svc) => svc.name.slice(0, -suffix.length))
    .sort();
}
