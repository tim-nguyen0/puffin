"""mission_node lifecycle node: flies the waypoint plan the api latched.

the api publishes a MissionRequest json body on /puffin/mission
(transient-local, so a plan posted before activation still arrives). on
activate this node parses the latest plan, streams warmup setpoints,
requests OFFBOARD, climbs to takeoff_z, walks the waypoints (loitering
hold_s at each), optionally returns to the activation point, then holds
until deactivated. progress goes out latched on /puffin/mission/status in
the contract's MissionStatus shape - the api relays it verbatim.

arming stays with the api (/vehicle/arm) - this node only flies, same
contract as offboard_demo.
"""

from typing import Any

from .mission_plan import MissionError, mission_steps, parse_mission, status_json
from .px4 import (
    MAIN_MODE_AUTO,
    MAIN_MODE_OFFBOARD,
    SUB_MODE_AUTO_LOITER,
    VEHICLE_CMD_DO_SET_MODE,
    fmu_qos,
    make_offboard_control_mode,
    make_position_setpoint,
    make_vehicle_command,
)
from .square import reached

# same ~1.2 s of setpoint streaming before the OFFBOARD request as
# offboard_demo (gotcha #4), scaled to the plan's rate
WARMUP_S = 1.2


def latched_qos() -> Any:
    # /puffin/mission* topics: reliable + transient-local so late joiners
    # (this node, the api's status cache) get the last message
    from rclpy.qos import (
        DurabilityPolicy,
        HistoryPolicy,
        QoSProfile,
        ReliabilityPolicy,
    )

    return QoSProfile(
        reliability=ReliabilityPolicy.RELIABLE,
        durability=DurabilityPolicy.TRANSIENT_LOCAL,
        history=HistoryPolicy.KEEP_LAST,
        depth=1,
    )


def main() -> None:
    import rclpy
    from rclpy.lifecycle import LifecycleNode, TransitionCallbackReturn

    class MissionNode(LifecycleNode):
        def __init__(self) -> None:
            super().__init__("mission_node")
            self._mode_pub: Any = None
            self._setpoint_pub: Any = None
            self._cmd_pub: Any = None
            self._status_pub: Any = None
            self._timer: Any = None
            self._position: tuple[float, float, float] | None = None
            self._heading = 0.0
            self._raw_mission: str | None = None
            self._steps: list[dict[str, Any]] = []
            self._step = 0
            self._total = 0
            self._phase = "warmup"
            self._ticks = 0
            self._warmup_ticks = 0
            self._hold_ticks = 0
            self._rate_hz = 20.0
            self._target: tuple[float, float, float] = (0.0, 0.0, 0.0)

        def on_configure(self, state: Any) -> TransitionCallbackReturn:
            from px4_msgs.msg import (
                OffboardControlMode,
                TrajectorySetpoint,
                VehicleCommand,
                VehicleLocalPosition,
            )
            from std_msgs.msg import String

            self._mode_pub = self.create_publisher(
                OffboardControlMode, "/fmu/in/offboard_control_mode", fmu_qos()
            )
            self._setpoint_pub = self.create_publisher(
                TrajectorySetpoint, "/fmu/in/trajectory_setpoint", fmu_qos()
            )
            self._cmd_pub = self.create_publisher(
                VehicleCommand, "/fmu/in/vehicle_command", fmu_qos()
            )
            self._status_pub = self.create_publisher(
                String, "/puffin/mission/status", latched_qos()
            )

            def store_position(msg: Any) -> None:
                self._position = (float(msg.x), float(msg.y), float(msg.z))
                self._heading = float(msg.heading)

            # px4 versions some topics across releases; only one publishes
            for topic in (
                "/fmu/out/vehicle_local_position_v1",
                "/fmu/out/vehicle_local_position",
            ):
                self.create_subscription(
                    VehicleLocalPosition, topic, store_position, fmu_qos()
                )

            def store_mission(msg: Any) -> None:
                self._raw_mission = msg.data
                if self._timer is None:
                    self._publish_status("ready", None, "latched; activate to fly")

            self.create_subscription(String, "/puffin/mission", store_mission, latched_qos())
            self._publish_status("idle", None, "no mission latched")
            return TransitionCallbackReturn.SUCCESS

        def on_activate(self, state: Any) -> TransitionCallbackReturn:
            if self._position is None:
                self.get_logger().error("no local position yet; refusing to fly blind")
                return TransitionCallbackReturn.FAILURE
            if self._raw_mission is None:
                self.get_logger().error("no mission latched; post one first")
                return TransitionCallbackReturn.FAILURE
            try:
                plan = parse_mission(self._raw_mission)
            except MissionError as exc:
                self.get_logger().error(f"bad mission: {exc}")
                self._publish_status("idle", None, f"bad mission: {exc}")
                return TransitionCallbackReturn.FAILURE

            x0, y0, _ = self._position
            self._steps = mission_steps(plan, x0, y0)
            self._total = len(plan["waypoints"])
            self._step = 0
            self._rate_hz = plan["rate_hz"]
            self._warmup_ticks = int(WARMUP_S * self._rate_hz)
            self._phase = "warmup"
            self._ticks = 0
            self._hold_ticks = 0
            self._target = (x0, y0, self._position[2])
            self._timer = self.create_timer(1.0 / self._rate_hz, self._tick)
            self.get_logger().info(
                f"mission: {self._total} waypoints from ({x0:.1f}, {y0:.1f})"
            )
            return super().on_activate(state)

        def on_deactivate(self, state: Any) -> TransitionCallbackReturn:
            # loiter before the stream stops, or px4 failsafes on setpoint loss
            self._cmd_pub.publish(
                make_vehicle_command(
                    self, VEHICLE_CMD_DO_SET_MODE, 1.0, MAIN_MODE_AUTO, SUB_MODE_AUTO_LOITER
                )
            )
            self._destroy_timer()
            if self._phase != "done":
                self._publish_status("aborted", None, "deactivated mid-mission")
            return super().on_deactivate(state)

        def on_cleanup(self, state: Any) -> TransitionCallbackReturn:
            self._destroy_timer()
            return TransitionCallbackReturn.SUCCESS

        def on_shutdown(self, state: Any) -> TransitionCallbackReturn:
            self._destroy_timer()
            # exit once the transition completes: supervisord respawns the
            # node fresh, so a ui "kill" is a clean restart
            self.create_timer(0.5, rclpy.shutdown)
            return TransitionCallbackReturn.SUCCESS

        def _destroy_timer(self) -> None:
            if self._timer is not None:
                self._timer.cancel()
                self.destroy_timer(self._timer)
                self._timer = None

        def _publish_status(self, state: str, index: int | None, detail: str) -> None:
            from std_msgs.msg import String

            msg = String()
            msg.data = status_json(state, index, self._total, detail)
            self._status_pub.publish(msg)

        def _current(self) -> dict[str, Any]:
            return self._steps[self._step]

        def _announce_step(self) -> None:
            step = self._current()
            self._target = step["target"]
            if step["kind"] == "takeoff":
                self._publish_status("flying", None, "climbing to takeoff altitude")
            elif step["kind"] == "return":
                self._publish_status("returning", None, "returning to origin")
            else:
                self._publish_status(
                    "flying", step["index"], f"waypoint {step['index'] + 1} of {self._total}"
                )

        def _advance(self) -> None:
            self._step += 1
            if self._step >= len(self._steps):
                self._phase = "done"
                self._publish_status("done", None, "mission complete, holding")
                self.get_logger().info("mission complete, holding last target")
            else:
                self._announce_step()

        def _tick(self) -> None:
            # every tick streams the heartbeat + current target, whatever phase
            self._mode_pub.publish(make_offboard_control_mode(self))
            self._setpoint_pub.publish(
                make_position_setpoint(self, self._target, self._heading)
            )
            self._ticks += 1

            if self._phase == "warmup":
                if self._ticks >= self._warmup_ticks:
                    self._cmd_pub.publish(
                        make_vehicle_command(
                            self, VEHICLE_CMD_DO_SET_MODE, 1.0, MAIN_MODE_OFFBOARD
                        )
                    )
                    self._phase = "fly"
                    self._announce_step()
            elif self._phase == "fly" and self._position is not None:
                if self._hold_ticks > 0:
                    self._hold_ticks -= 1
                    if self._hold_ticks == 0:
                        self._advance()
                elif reached(self._position, self._target):
                    step = self._current()
                    if step["hold_s"] > 0:
                        self._hold_ticks = max(1, int(step["hold_s"] * self._rate_hz))
                        self._publish_status(
                            "holding", step["index"], f"holding {step['hold_s']:.0f}s"
                        )
                    else:
                        self._advance()

    rclpy.init()
    node = MissionNode()
    node.trigger_configure()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
