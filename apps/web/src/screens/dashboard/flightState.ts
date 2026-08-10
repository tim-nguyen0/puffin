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
