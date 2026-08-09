// the inverse of the viewport's ned -> scene mapping, plus the two rounding
// rules dragging needs. pure math, no three dependency, so it tests anywhere.
//
// scene frame is three.js convention: x east, y up, z south.
// ned frame is px4 convention: x north, y east, z down.

import type { Vec3 } from "../scene-viewport/frames";

// waypoints stay this far above the pad; the executor refuses anything lower
export const MIN_CLEARANCE_M = 1;

// inverse of nedToScene, which is [east, -down, -north]
export function sceneToNed(x: number, y: number, z: number): Vec3 {
  return [-z, x, -y];
}

// waypoints are also typed by hand in the builder; 0.1 m keeps drag output
// the same shape as what a human would enter. the +0 folds -0 to 0.
export function roundM(value: number): number {
  return Math.round(value * 10) / 10 + 0;
}

// ned z is down, so -1 is one metre up and anything greater is underground
export function clampGroundZ(down: number): number {
  return Math.min(down, -MIN_CLEARANCE_M);
}
