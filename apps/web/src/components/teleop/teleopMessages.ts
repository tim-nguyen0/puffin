// ned frame, matching the sim teleop node: x north (forward), y east
// (right), z down. the node clamps, so these are just comfortable speeds.
export const TELEOP_SPEED_M_S = 2.0;
export const TELEOP_VERTICAL_M_S = 1.0;

export type TeleopDirection = "forward" | "back" | "left" | "right" | "up" | "down";

export interface TeleopFrame {
  vx: number;
  vy: number;
  vz: number;
  yaw_rate: number;
}

export function teleopFrame(held: ReadonlySet<TeleopDirection>): TeleopFrame {
  let vx = 0;
  let vy = 0;
  let vz = 0;
  if (held.has("forward")) vx += TELEOP_SPEED_M_S;
  if (held.has("back")) vx -= TELEOP_SPEED_M_S;
  if (held.has("right")) vy += TELEOP_SPEED_M_S;
  if (held.has("left")) vy -= TELEOP_SPEED_M_S;
  if (held.has("down")) vz += TELEOP_VERTICAL_M_S;
  if (held.has("up")) vz -= TELEOP_VERTICAL_M_S;
  return { vx, vy, vz, yaw_rate: 0 };
}

export function teleopWebSocketUrl(protocol: string, host: string): string {
  const websocketProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${websocketProtocol}//${host}/ws/teleop`;
}
