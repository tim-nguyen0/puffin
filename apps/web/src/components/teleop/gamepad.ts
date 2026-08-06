// gamepad -> teleop frame mapping. pure math over the axes array, so it
// tests anywhere. mode-2 rc convention on a standard-layout pad:
// left stick = throttle (vertical) + yaw rate (horizontal),
// right stick = north/south (vertical) + east/west (horizontal).
// frames are ned world-frame like the button pad; the sim-side node
// still clamps and deadman-hovers.
import { TELEOP_SPEED_M_S, TELEOP_VERTICAL_M_S, type TeleopFrame } from "./teleopMessages";

export const TELEOP_YAW_RATE_RAD_S = 0.8;
export const STICK_DEADZONE = 0.12;

// gamepad api: stick up is negative; rescale outside the deadzone so
// small drift near center stays exactly zero
export function applyDeadzone(value: number, deadzone = STICK_DEADZONE): number {
  if (Math.abs(value) < deadzone) return 0;
  const sign = Math.sign(value);
  return (value - sign * deadzone) / (1 - deadzone);
}

export function gamepadFrame(axes: readonly number[], deadzone = STICK_DEADZONE): TeleopFrame {
  const leftX = applyDeadzone(axes[0] ?? 0, deadzone);
  const leftY = applyDeadzone(axes[1] ?? 0, deadzone);
  const rightX = applyDeadzone(axes[2] ?? 0, deadzone);
  const rightY = applyDeadzone(axes[3] ?? 0, deadzone);

  // + 0 folds the -0 a negated centered axis produces into plain 0
  return {
    // right stick up = north, right = east
    vx: -rightY * TELEOP_SPEED_M_S + 0,
    vy: rightX * TELEOP_SPEED_M_S + 0,
    // left stick up = climb; ned z is down, so up maps negative
    vz: leftY * TELEOP_VERTICAL_M_S + 0,
    yaw_rate: leftX * TELEOP_YAW_RATE_RAD_S + 0,
  };
}

export function frameIsActive(frame: TeleopFrame): boolean {
  return frame.vx !== 0 || frame.vy !== 0 || frame.vz !== 0 || frame.yaw_rate !== 0;
}
