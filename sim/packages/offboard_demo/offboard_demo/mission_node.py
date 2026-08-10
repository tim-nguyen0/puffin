"""mission host: one process, one named lifecycle executor per mission.

the api posts a MissionRequest json body on /puffin/mission (transient-local,
so a plan posted before this process started still arrives). the host parses
it and builds an in-process lifecycle node called `name` that owns that plan,
then configures it to inactive so the api only ever needs "activate" - same
contract as offboard_demo. re-posting a name rebuilds its executor around the
new plan; a rebuild is refused while that node is active, because tearing it
down would drop the setpoint stream mid-air. every executor reports progress
latched on /puffin/mission/status in the contract's MissionStatus shape, keyed
by node.

arming stays with the api (/vehicle/arm) - these nodes only fly.

the executor is also the whole of a forged node (see forge.py): run_executor
spins one in its own process, so a forged package and a host child are the
same flight code under a different lifetime.
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

# standalone only: how long the stream stays up after the last step, so px4
# settles on the final target while it is still being fed. the loiter handover
# happens at the end of this, never during it.
GRACE_S = 5.0

# rclpy.shutdown() is deferred by this much so the loiter command, the final
# status and any lifecycle reply are on the wire before the context closes
EXIT_DELAY_S = 0.5


def grace_ticks(rate_hz: float) -> int:
    """setpoint ticks a standalone node streams between "done" and exiting.

    never zero: cutting the stream on the same tick that reports done would
    leave px4 with nothing between the last setpoint and the loiter.
    """
    return max(1, int(GRACE_S * rate_hz))


def latched_qos() -> Any:
    # /puffin/mission* topics: reliable + transient-local so late joiners
    # (this host, the api's status cache) get the last message
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


def executor_class() -> Any:
    """builds the MissionExecutor class. the rclpy import is deferred to here
    so this module stays importable (and testable) without ros.

    the host calls this once and builds one executor per primed plan; forged
    nodes call it through run_executor, so both fly identical code.
    """
    from rclpy.lifecycle import LifecycleNode, TransitionCallbackReturn

    class MissionExecutor(LifecycleNode):
        """one plan, one ros node: activate it and it flies that plan.

        the plan is fixed at construction - the host rebuilds the node to
        change it, so nothing here re-reads a shared latch mid-flight.
        standalone means this node owns its process (a forged node) rather
        than sharing the host's, which also makes it a one-shot: it loiters
        and exits when the mission ends instead of holding the last target
        forever. a host child has no process to end, so it holds.
        """

        def __init__(
            self, name: str, plan: dict[str, Any], standalone: bool = False
        ) -> None:
            super().__init__(name)
            self._plan = plan
            self._standalone = standalone
            self._mode_pub: Any = None
            self._setpoint_pub: Any = None
            self._cmd_pub: Any = None
            self._status_pub: Any = None
            self._timer: Any = None
            self._position: tuple[float, float, float] | None = None
            self._heading = 0.0
            self._steps: list[dict[str, Any]] = []
            self._step = 0
            self._total = len(plan["waypoints"])
            self._phase = "warmup"
            self._ticks = 0
            self._warmup_ticks = 0
            self._hold_ticks = 0
            self._grace_ticks = 0
            self._exiting = False
            self._rate_hz = plan["rate_hz"]
            self._target: tuple[float, float, float] = (0.0, 0.0, 0.0)
            self._state = "ready"
            self._index: int | None = None
            # mirrors the lifecycle active state; the host reads it before
            # rebuilding this node
            self.is_flying = False

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
            # every executor reports on the one shared status topic
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
            return TransitionCallbackReturn.SUCCESS

        def on_activate(self, state: Any) -> TransitionCallbackReturn:
            if self._position is None:
                self.get_logger().error("no local position yet; refusing to fly blind")
                return TransitionCallbackReturn.FAILURE

            x0, y0, _ = self._position
            self._steps = mission_steps(self._plan, x0, y0)
            self._step = 0
            self._warmup_ticks = int(WARMUP_S * self._rate_hz)
            self._phase = "warmup"
            self._ticks = 0
            self._hold_ticks = 0
            self._target = (x0, y0, self._position[2])
            # warmup publishes nothing; carry the phase so a refusal mid-warmup
            # doesn't report this node as still merely ready
            self._state = "flying"
            self._timer = self.create_timer(1.0 / self._rate_hz, self._tick)
            self.get_logger().info(
                f"mission: {self._total} waypoints from ({x0:.1f}, {y0:.1f})"
            )
            result = super().on_activate(state)
            self.is_flying = result == TransitionCallbackReturn.SUCCESS
            return result

        def on_deactivate(self, state: Any) -> TransitionCallbackReturn:
            self._loiter()
            self._destroy_timer()
            self.is_flying = False
            if self._phase != "done":
                self._publish_status("aborted", None, "deactivated mid-mission")
            # a forged node is a one-shot, abort included: ending the process
            # here means the next start replays the plan from the top
            if self._standalone:
                self._exit_process()
            return super().on_deactivate(state)

        def on_cleanup(self, state: Any) -> TransitionCallbackReturn:
            self._destroy_timer()
            self.is_flying = False
            return TransitionCallbackReturn.SUCCESS

        def on_shutdown(self, state: Any) -> TransitionCallbackReturn:
            self._destroy_timer()
            self.is_flying = False
            # a host child must not call rclpy.shutdown(): it is one of many
            # nodes in the host process, and the host outlives it. a forged
            # node owns its process, so a ui kill ends it - it parks at
            # EXITED and `supervisorctl start <name>` brings it back.
            if self._standalone:
                self._exit_process()
            return TransitionCallbackReturn.SUCCESS

        def _destroy_timer(self) -> None:
            if self._timer is not None:
                self._timer.cancel()
                self.destroy_timer(self._timer)
                self._timer = None

        def _loiter(self) -> None:
            # px4 failsafes on setpoint loss, so it goes to AUTO.LOITER before
            # the stream stops. every path that stops the timer comes here first.
            self._cmd_pub.publish(
                make_vehicle_command(
                    self, VEHICLE_CMD_DO_SET_MODE, 1.0, MAIN_MODE_AUTO, SUB_MODE_AUTO_LOITER
                )
            )

        def _exit_process(self) -> None:
            """standalone only: end this process cleanly, once."""
            if self._exiting:
                return
            self._exiting = True
            import rclpy

            # deferred, not immediate: shutting the context down inside this
            # callback would cut whatever it was called from mid-publish
            self.create_timer(EXIT_DELAY_S, rclpy.shutdown)

        def _autokill(self) -> None:
            """end of the post-mission grace: hand px4 over and exit 0."""
            self._loiter()
            self._destroy_timer()
            self.is_flying = False
            self._publish_status("done", None, "mission complete; node exiting")
            self.get_logger().info("mission complete; loitering and exiting")
            self._exit_process()

        def report_refusal(self, detail: str) -> None:
            # re-states the phase this node is already in; only detail says
            # why the new plan bounced
            self._publish_status(self._state, self._index, detail)

        def _publish_status(self, state: str, index: int | None, detail: str) -> None:
            from std_msgs.msg import String

            self._state = state
            self._index = index
            msg = String()
            msg.data = status_json(self.get_name(), state, index, self._total, detail)
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
                if self._standalone:
                    self._grace_ticks = grace_ticks(self._rate_hz)
                    hold = f"holding {GRACE_S:.0f}s, then loitering and exiting"
                    self._publish_status("done", None, f"mission complete; {hold}")
                    self.get_logger().info(f"mission complete; {hold}")
                else:
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
            elif self._phase == "done" and self._standalone:
                # the stream above keeps running through the whole grace; only
                # when it runs out does this node let go of px4 and exit
                self._grace_ticks -= 1
                if self._grace_ticks <= 0:
                    self._autokill()

    return MissionExecutor


def run_executor(name: str, plan: dict[str, Any]) -> None:
    """spins one executor as its own process - what a forged node's main does.

    same contract as a host child: it configures itself to inactive at boot,
    reports on /puffin/mission/status under `name`, and waits for the api to
    activate it. unlike a host child it is a one-shot - the executor shuts the
    context down once the mission ends or is aborted, so this returns and the
    process exits 0, which supervisord reads as EXITED rather than a crash.
    """
    import rclpy
    from rclpy.executors import ExternalShutdownException

    rclpy.init()
    node = executor_class()(name, plan, standalone=True)
    node.trigger_configure()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        # ctrl-c, or this node's own shutdown timer. either way the terminal
        # status is already published, so returning here is the clean exit
        pass


def main() -> None:
    import rclpy
    from rclpy.executors import SingleThreadedExecutor
    from rclpy.node import Node

    MissionExecutor = executor_class()

    class MissionHost(Node):
        """plain node that owns the executors and the /puffin/mission latch."""

        def __init__(self, spinner: Any) -> None:
            super().__init__("mission_host")
            from std_msgs.msg import String

            self._spinner = spinner
            self._executors: dict[str, MissionExecutor] = {}
            self._status_pub = self.create_publisher(
                String, "/puffin/mission/status", latched_qos()
            )
            self.create_subscription(
                String, "/puffin/mission", self._on_mission, latched_qos()
            )
            self._publish_status(None, "idle", 0, "no mission primed")

        def _publish_status(
            self, node: str | None, state: str, total: int, detail: str
        ) -> None:
            from std_msgs.msg import String

            msg = String()
            msg.data = status_json(node, state, None, total, detail)
            self._status_pub.publish(msg)

        def _on_mission(self, msg: Any) -> None:
            try:
                plan = parse_mission(msg.data)
            except MissionError as exc:
                self.get_logger().error(f"bad mission: {exc}")
                self._publish_status(None, "idle", 0, f"bad mission: {exc}")
                return

            name = plan["name"]
            total = len(plan["waypoints"])
            old = self._executors.get(name)
            if old is not None and old.is_flying:
                # destroying an active node would cut its setpoint stream
                self.get_logger().warn(f"{name} is active; refusing to rebuild it")
                old.report_refusal(f"rebuild refused: {name} is active, deactivate it first")
                return

            if old is not None:
                self._spinner.remove_node(old)
                old.destroy_node()
                del self._executors[name]

            node = MissionExecutor(name, plan)
            self._spinner.add_node(node)
            # boot it to inactive here so the api only ever sends "activate"
            node.trigger_configure()
            self._executors[name] = node
            verb = "rebuilt" if old is not None else "primed"
            self.get_logger().info(f"{verb} {name}: {total} waypoints")
            self._publish_status(name, "ready", total, f"{verb}; activate {name} to fly")

    rclpy.init()
    # one executor spins the host and every mission node it builds
    spinner = SingleThreadedExecutor()
    host = MissionHost(spinner)
    spinner.add_node(host)
    try:
        spinner.spin()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
