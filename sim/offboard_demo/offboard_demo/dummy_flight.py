"""dummy_flight: self-contained end-to-end smoke test (BUILD.md rung 6).

`ros2 run offboard_demo dummy_flight square` needs no api and no lifecycle
transitions: it streams setpoints, switches to OFFBOARD, arms, climbs, flies
the square, lands, and exits 0 once px4 auto-disarms. Anything that stalls
longer than the deadline exits 1 — the command path is broken somewhere
below rung 6.
"""

import argparse
import sys
import time
from typing import Any

from .px4 import (
    MAIN_MODE_OFFBOARD,
    STREAM_HZ,
    VEHICLE_CMD_ARM_DISARM,
    VEHICLE_CMD_DO_SET_MODE,
    VEHICLE_CMD_NAV_LAND,
    WARMUP_TICKS,
    fmu_qos,
    make_offboard_control_mode,
    make_position_setpoint,
    make_vehicle_command,
)
from .square import reached, square_waypoints

DEADLINE_S = 180.0
POSITION_WAIT_S = 20.0


def main() -> int:
    parser = argparse.ArgumentParser(prog="dummy_flight")
    parser.add_argument("pattern", choices=["square"])
    parser.add_argument("--side", type=float, default=10.0, help="square side, meters")
    parser.add_argument("--alt", type=float, default=5.0, help="altitude, meters up")
    args = parser.parse_args()

    import rclpy
    from px4_msgs.msg import (
        OffboardControlMode,
        TrajectorySetpoint,
        VehicleCommand,
        VehicleLocalPosition,
        VehicleStatus,
    )

    rclpy.init()
    node = rclpy.create_node("dummy_flight")

    mode_pub = node.create_publisher(
        OffboardControlMode, "/fmu/in/offboard_control_mode", fmu_qos()
    )
    setpoint_pub = node.create_publisher(
        TrajectorySetpoint, "/fmu/in/trajectory_setpoint", fmu_qos()
    )
    cmd_pub = node.create_publisher(VehicleCommand, "/fmu/in/vehicle_command", fmu_qos())

    state: dict[str, Any] = {"position": None, "heading": 0.0, "armed": None}

    def on_position(msg: Any) -> None:
        state["position"] = (float(msg.x), float(msg.y), float(msg.z))
        state["heading"] = float(msg.heading)

    def on_status(msg: Any) -> None:
        state["armed"] = msg.arming_state == VehicleStatus.ARMING_STATE_ARMED

    # px4 versions some topics across releases; only one publishes
    for base, msg_type, cb in (
        ("vehicle_local_position", VehicleLocalPosition, on_position),
        ("vehicle_status", VehicleStatus, on_status),
    ):
        for topic in (f"/fmu/out/{base}_v1", f"/fmu/out/{base}"):
            node.create_subscription(msg_type, topic, cb, fmu_qos())

    def spin_for(seconds: float) -> None:
        end = time.monotonic() + seconds
        while rclpy.ok() and time.monotonic() < end:
            rclpy.spin_once(node, timeout_sec=0.05)

    print("waiting for local position...")
    waited = time.monotonic()
    while state["position"] is None:
        if time.monotonic() - waited > POSITION_WAIT_S:
            print("no /fmu/out/vehicle_local_position data — check ladder rung 5")
            return 1
        rclpy.spin_once(node, timeout_sec=0.2)

    x0, y0, _z0 = state["position"]
    z_hold = -abs(args.alt)
    # climb straight up first, then the square
    waypoints = [(x0, y0, z_hold), *square_waypoints(x0, y0, z_hold, side_m=args.side)]
    target = waypoints[0]
    print(f"flying {args.side:.0f} m square at {abs(z_hold):.0f} m from ({x0:.1f}, {y0:.1f})")

    deadline = time.monotonic() + DEADLINE_S
    phase = "warmup"
    ticks = 0
    was_armed = False
    while rclpy.ok() and time.monotonic() < deadline:
        if phase in ("warmup", "fly"):
            mode_pub.publish(make_offboard_control_mode(node))
            setpoint_pub.publish(make_position_setpoint(node, target, state["heading"]))
        ticks += 1
        if phase == "warmup" and ticks >= WARMUP_TICKS:
            # offboard first, then arm — px4 accepts arming once the stream
            # and mode are already in place
            cmd_pub.publish(
                make_vehicle_command(node, VEHICLE_CMD_DO_SET_MODE, 1.0, MAIN_MODE_OFFBOARD)
            )
            cmd_pub.publish(make_vehicle_command(node, VEHICLE_CMD_ARM_DISARM, 1.0))
            phase = "fly"
        elif phase == "fly":
            if state["armed"]:
                was_armed = True
            if reached(state["position"], target):
                waypoints = waypoints[1:]
                if waypoints:
                    target = waypoints[0]
                    print(f"waypoint reached, next ({target[0]:.1f}, {target[1]:.1f})")
                else:
                    print("square complete, landing")
                    cmd_pub.publish(make_vehicle_command(node, VEHICLE_CMD_NAV_LAND))
                    phase = "land"
        elif phase == "land" and was_armed and state["armed"] is False:
            print("landed and disarmed — command path ok")
            return 0
        spin_for(1.0 / STREAM_HZ)

    print(f"gave up after {DEADLINE_S:.0f}s in phase {phase!r}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
