"""offboard_demo lifecycle node: activate it and the drone flies a 10 m square.

Boots straight to inactive (configured) so the api only ever needs to send
"activate". On activate it streams position setpoints at the current pose for
~1 s, requests OFFBOARD, then walks the square and holds the start corner
until deactivated. Deactivate hands px4 back to AUTO.LOITER so the vehicle
never loses its setpoint stream mid-air.

Arming and takeoff stay with the api (/vehicle/*) — this node only flies.
"""

from typing import Any

from .px4 import (
    MAIN_MODE_AUTO,
    MAIN_MODE_OFFBOARD,
    STREAM_HZ,
    SUB_MODE_AUTO_LOITER,
    VEHICLE_CMD_DO_SET_MODE,
    WARMUP_TICKS,
    fmu_qos,
    make_offboard_control_mode,
    make_position_setpoint,
    make_vehicle_command,
)
from .square import hold_altitude, reached, square_waypoints


def main() -> None:
    import rclpy
    from rclpy.lifecycle import LifecycleNode, TransitionCallbackReturn

    class OffboardDemoNode(LifecycleNode):
        def __init__(self) -> None:
            super().__init__("offboard_demo")
            self._mode_pub: Any = None
            self._setpoint_pub: Any = None
            self._cmd_pub: Any = None
            self._position_sub: Any = None
            self._timer: Any = None
            self._position: tuple[float, float, float] | None = None
            self._heading = 0.0
            self._phase = "warmup"
            self._ticks = 0
            self._waypoints: list[tuple[float, float, float]] = []
            self._target: tuple[float, float, float] = (0.0, 0.0, 0.0)

        def on_configure(self, state: Any) -> TransitionCallbackReturn:
            from px4_msgs.msg import (
                OffboardControlMode,
                TrajectorySetpoint,
                VehicleCommand,
                VehicleLocalPosition,
            )

            self._mode_pub = self.create_publisher(
                OffboardControlMode, "/fmu/in/offboard_control_mode", fmu_qos()
            )
            self._setpoint_pub = self.create_publisher(
                TrajectorySetpoint, "/fmu/in/trajectory_setpoint", fmu_qos()
            )
            self._cmd_pub = self.create_publisher(
                VehicleCommand, "/fmu/in/vehicle_command", fmu_qos()
            )

            def store(msg: Any) -> None:
                self._position = (float(msg.x), float(msg.y), float(msg.z))
                self._heading = float(msg.heading)

            # px4 versions some topics across releases; only one publishes
            for topic in (
                "/fmu/out/vehicle_local_position_v1",
                "/fmu/out/vehicle_local_position",
            ):
                self.create_subscription(VehicleLocalPosition, topic, store, fmu_qos())
            return TransitionCallbackReturn.SUCCESS

        def on_activate(self, state: Any) -> TransitionCallbackReturn:
            if self._position is None:
                self.get_logger().error("no local position yet; refusing to fly blind")
                return TransitionCallbackReturn.FAILURE
            x0, y0, z0 = self._position
            z_hold = hold_altitude(z0)
            self._waypoints = square_waypoints(x0, y0, z_hold)
            self._target = (x0, y0, z_hold)
            self._phase = "warmup"
            self._ticks = 0
            self._timer = self.create_timer(1.0 / STREAM_HZ, self._tick)
            self.get_logger().info(f"square from ({x0:.1f}, {y0:.1f}) at z={z_hold:.1f}")
            return super().on_activate(state)

        def on_deactivate(self, state: Any) -> TransitionCallbackReturn:
            # loiter before the stream stops, or px4 failsafes on setpoint loss
            self._cmd_pub.publish(
                make_vehicle_command(
                    self, VEHICLE_CMD_DO_SET_MODE, 1.0, MAIN_MODE_AUTO, SUB_MODE_AUTO_LOITER
                )
            )
            self._destroy_timer()
            return super().on_deactivate(state)

        def on_cleanup(self, state: Any) -> TransitionCallbackReturn:
            self._destroy_timer()
            return TransitionCallbackReturn.SUCCESS

        def on_shutdown(self, state: Any) -> TransitionCallbackReturn:
            self._destroy_timer()
            return TransitionCallbackReturn.SUCCESS

        def _destroy_timer(self) -> None:
            if self._timer is not None:
                self._timer.cancel()
                self.destroy_timer(self._timer)
                self._timer = None

        def _tick(self) -> None:
            # every tick streams the heartbeat + current target, whatever phase
            self._mode_pub.publish(make_offboard_control_mode(self))
            self._setpoint_pub.publish(
                make_position_setpoint(self, self._target, self._heading)
            )
            self._ticks += 1
            if self._phase == "warmup":
                if self._ticks >= WARMUP_TICKS:
                    self._cmd_pub.publish(
                        make_vehicle_command(
                            self, VEHICLE_CMD_DO_SET_MODE, 1.0, MAIN_MODE_OFFBOARD
                        )
                    )
                    self._phase = "fly"
                    self._target = self._waypoints[0]
            elif (
                self._phase == "fly"
                and self._position is not None
                and reached(self._position, self._target)
            ):
                self._waypoints = self._waypoints[1:]
                if self._waypoints:
                    self._target = self._waypoints[0]
                else:
                    self._phase = "hold"
                    self.get_logger().info("square complete, holding start corner")

    rclpy.init()
    node = OffboardDemoNode()
    node.trigger_configure()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
