"""teleop lifecycle node: manual velocity flight from the control panel.

Boots to inactive like offboard_demo. On activate it streams velocity
setpoints - zero until commands arrive on /puffin/teleop/cmd_vel (Twist,
NED: x north, y east, z down in linear; yaw rate in angular.z). A command
older than the deadman window means hover, so a dropped websocket never
flies away. Deactivate hands px4 back to AUTO.LOITER.

Arming stays with the api; this node only translates held buttons into
motion.
"""

import time
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
    make_vehicle_command,
    make_velocity_setpoint,
)
from .velocity import safe_velocity


def main() -> None:
    import rclpy
    from rclpy.lifecycle import LifecycleNode, TransitionCallbackReturn

    class TeleopNode(LifecycleNode):
        def __init__(self) -> None:
            super().__init__("teleop")
            self._mode_pub: Any = None
            self._setpoint_pub: Any = None
            self._cmd_pub: Any = None
            self._timer: Any = None
            self._ticks = 0
            self._command = (0.0, 0.0, 0.0, 0.0)
            self._command_at = 0.0

        def on_configure(self, state: Any) -> TransitionCallbackReturn:
            from geometry_msgs.msg import Twist
            from px4_msgs.msg import (
                OffboardControlMode,
                TrajectorySetpoint,
                VehicleCommand,
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
                self._command = (
                    float(msg.linear.x),
                    float(msg.linear.y),
                    float(msg.linear.z),
                    float(msg.angular.z),
                )
                self._command_at = time.monotonic()

            self.create_subscription(Twist, "/puffin/teleop/cmd_vel", store, 10)
            return TransitionCallbackReturn.SUCCESS

        def on_activate(self, state: Any) -> TransitionCallbackReturn:
            self._ticks = 0
            self._command = (0.0, 0.0, 0.0, 0.0)
            self._command_at = 0.0
            self._timer = self.create_timer(1.0 / STREAM_HZ, self._tick)
            self.get_logger().info("teleop streaming; deadman hover when idle")
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
            # exit once the transition completes: supervisord respawns the
            # node fresh, so a ui kill is a clean restart
            self.create_timer(0.5, rclpy.shutdown)
            return TransitionCallbackReturn.SUCCESS

        def _destroy_timer(self) -> None:
            if self._timer is not None:
                self._timer.cancel()
                self.destroy_timer(self._timer)
                self._timer = None

        def _tick(self) -> None:
            vx, vy, vz, yaw_rate = safe_velocity(
                *self._command, age_s=time.monotonic() - self._command_at
            )
            self._mode_pub.publish(make_offboard_control_mode(self, velocity=True))
            self._setpoint_pub.publish(
                make_velocity_setpoint(self, (vx, vy, vz), yaw_rate)
            )
            self._ticks += 1
            if self._ticks == WARMUP_TICKS:
                # offboard order (gotcha #4): stream first, then request
                self._cmd_pub.publish(
                    make_vehicle_command(self, VEHICLE_CMD_DO_SET_MODE, 1.0, MAIN_MODE_OFFBOARD)
                )

    rclpy.init()
    node = TeleopNode()
    node.trigger_configure()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
