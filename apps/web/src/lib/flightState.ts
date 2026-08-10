import type { components } from "@puffin/api-types";

type TelemetrySample = components["schemas"]["TelemetrySample"];

// px4's land detector, not an altitude threshold. the ned z is an estimate
// against an ekf origin that drifts metres upward across a few flights, so
// "altitude > x" eventually calls a parked vehicle airborne and never lets
// go. no sample at all reads grounded: the controls it gates are safe to
// offer on the ground and dangerous to offer in the air.
export function isAirborne(live: boolean, latest: TelemetrySample | null): boolean {
  return live && latest !== null && !latest.landed;
}

// activating a flight node streams offboard setpoints from wherever the
// vehicle already is. on the ground that is a spin-up against the dirt, so
// takeoff has to have happened first - and it has already done the arming.
// only activation is gated: stopping a node is the way out of a bad flight
// and must stay reachable from every state.
export const GROUNDED_TITLE = "take off first - the vehicle is on the ground";

export function runGateTitle(airborne: boolean): string | undefined {
  return airborne ? undefined : GROUNDED_TITLE;
}
