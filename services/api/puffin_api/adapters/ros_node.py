"""Wrapper around rclpy. The only place that talks to ROS 2.

rclpy only exists inside the ROS-based containers, so every ROS import stays
inside a method body; on any failure methods degrade to a clean {ok, detail}.

One node is created lazily and spun by a background executor thread for the
life of the process. Graph queries need no spinning, but the node must be
long-lived anyway: DDS discovery is gossip, and a fresh node knows nothing.
"""

import json
import os
import threading
import time
from typing import Any

from . import AdapterResult

# VehicleCommand command ids (px4_msgs constants, stable across PX4 releases).
VEHICLE_CMD_NAV_LAND = 21
VEHICLE_CMD_NAV_TAKEOFF = 22
VEHICLE_CMD_ARM_DISARM = 400

# VehicleCommandAck.result values (px4_msgs constants) -> (ok, human label).
VEHICLE_CMD_RESULTS = {
    0: (True, "accepted"),
    1: (False, "temporarily rejected"),
    2: (False, "denied"),
    3: (False, "unsupported"),
    4: (False, "failed"),
    5: (True, "in progress"),
    6: (False, "cancelled"),
}
ACK_TIMEOUT_S = 1.5

LIFECYCLE_CALL_TIMEOUT_S = 3.0
LIFECYCLE_SERVICE_WAIT_S = 1.0
LIFECYCLE_STATE_LABELS = {"unconfigured", "inactive", "active", "finalized"}
LIFECYCLE_CHANGE_STATE_TYPE = "lifecycle_msgs/srv/ChangeState"

# how long to let px4 apply a deactivated node's AUTO.LOITER handoff before
# landing on top of it. the two commands come from different publishers, so
# nothing orders them but the wait.
MODE_HANDOFF_TIMEOUT_S = 2.0
MODE_HANDOFF_POLL_S = 0.05

# a /fmu/out sample older than this is not telemetry, it is a memory: px4
# publishes vehicle_status at ~2 Hz, so nothing live is ever this old. px4
# restarts (a vehicle swap) would otherwise stream the dead airframe's last
# words on as if they were the new one's.
TELEMETRY_STALE_S = 3.0


def fmu_out_qos() -> Any:
    """The ONE QoS profile for every /fmu/out/* subscription.

    BEST_EFFORT + TRANSIENT_LOCAL + KEEP_LAST(1) — anything else matches PX4's
    publishers silently never, per CLAUDE.md gotcha #1. Never inline another.
    """
    from rclpy.qos import (
        DurabilityPolicy,
        HistoryPolicy,
        QoSProfile,
        ReliabilityPolicy,
    )

    return QoSProfile(
        reliability=ReliabilityPolicy.BEST_EFFORT,
        durability=DurabilityPolicy.TRANSIENT_LOCAL,
        history=HistoryPolicy.KEEP_LAST,
        depth=1,
    )


def latched_qos() -> Any:
    """QoS for the /puffin/mission* topics, mirroring the sim-side node.

    RELIABLE + TRANSIENT_LOCAL + KEEP_LAST(1) - a mission latched before
    mission_node activates still arrives, and this api sees the last
    status even if it subscribed late.
    """
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


class RosAdapter:
    def __init__(self) -> None:
        self._init_lock = threading.Lock()
        self._data_lock = threading.Lock()
        self._node: Any = None
        self._executor: Any = None
        self._cmd_pub: Any = None
        self._pubs: dict[str, Any] = {}
        self._lifecycle_clients: dict[str, Any] = {}
        self._latest: dict[str, Any] = {}
        self._received_at: dict[str, float] = {}
        self._nav_states: dict[int, str] = {}
        self._telemetry_ready = False
        self._mission_ready = False
        self._acks: dict[int, Any] = {}
        self._ack_cond = threading.Condition()

    # -- node / executor plumbing ------------------------------------------

    def _ensure_node(self) -> Any:
        with self._init_lock:
            if self._node is None:
                import rclpy
                from rclpy.executors import SingleThreadedExecutor

                if not rclpy.ok():
                    rclpy.init()
                self._node = rclpy.create_node("puffin_api")
                # in background so service responses and telemetry
                # callbacks arrive -> request threads block on Events instead.
                self._executor = SingleThreadedExecutor()
                self._executor.add_node(self._node)
                threading.Thread(
                    target=self._executor.spin, name="ros-spin", daemon=True
                ).start()
        return self._node

    def _call(self, client: Any, request: Any, timeout_s: float = LIFECYCLE_CALL_TIMEOUT_S) -> Any:
        done = threading.Event()
        future = client.call_async(request)
        future.add_done_callback(lambda _future: done.set())
        if not done.wait(timeout_s):
            client.remove_pending_request(future)
            raise TimeoutError(f"service call timed out after {timeout_s}s")
        return future.result()

    def _lifecycle_client(self, service_name: str, service: str) -> Any:
        from lifecycle_msgs.srv import ChangeState, GetState

        node = self._ensure_node()
        with self._init_lock:
            client = self._lifecycle_clients.get(service_name)
            if client is None:
                srv_type = GetState if service == "get_state" else ChangeState
                client = node.create_client(srv_type, service_name)
                self._lifecycle_clients[service_name] = client
        return client

    def _drop_lifecycle_client(self, service_name: str) -> None:
        """Forget a lifecycle client and free its endpoints.

        Forged nodes are one-shot processes: the one that answered this name
        is gone after its mission, and the next `supervisorctl start` is a
        different process re-registering the same service. Keeping a client
        past a failed call leaves that many dead endpoints on the graph and
        bets the ui's state on a binding nothing owns - the next call builds
        a fresh client against whoever holds the name then.
        """
        with self._init_lock:
            client = self._lifecycle_clients.pop(service_name, None)
        if client is None:
            return
        try:
            self._node.destroy_client(client)
        except Exception:  # noqa: BLE001 - a client we are discarding anyway
            pass

    def _lifecycle_call(self, node_name: str, service: str, request: Any) -> AdapterResult:
        """One lifecycle round trip; data is the raw response on success.

        Both failure paths mean the same thing to the ui - nobody is home -
        so both read as "not available" and both drop the client.
        """
        service_name = f"/{node_name.strip('/')}/{service}"
        client = self._lifecycle_client(service_name, service)
        if not client.wait_for_service(timeout_sec=LIFECYCLE_SERVICE_WAIT_S):
            self._drop_lifecycle_client(service_name)
            return AdapterResult(ok=False, detail=f"{service_name} not available")
        try:
            response = self._call(client, request)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            # discovery said the service was there and nobody answered: the
            # node died between the two. it is gone, not slow.
            self._drop_lifecycle_client(service_name)
            return AdapterResult(ok=False, detail=f"{service_name} not available: {exc}")
        return AdapterResult(ok=True, data=response)

    def warmup(self) -> None:
        # pre-create pubs/subs at startup so dds discovery has converged
        # before the first user command; best-effort — without rclpy the
        # first real call will surface the failure cleanly
        try:
            self._ensure_cmd_pub()
            self._ensure_telemetry()
        except Exception:  # noqa: BLE001 - warmup never fails the app
            pass

    # -- graph --------------------------------------------------------------

    def list_services(self) -> AdapterResult:
        try:
            services = self._ensure_node().get_service_names_and_types()
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"ros graph unavailable: {exc}")
        return AdapterResult(
            ok=True,
            data=[{"name": name, "type": types[0]} for name, types in services if types],
        )

    def graph(self) -> AdapterResult:
        def endpoint_nodes(infos: Any) -> list[str]:
            # fastdds registers bare (non-ros) participants under a
            # placeholder; the only one in this stack is the uxrce agent
            # bridging px4, so label it as such instead of
            # _CREATED_BY_BARE_DDS_APP_/_CREATED_BY_BARE_DDS_APP_
            names = set()
            for info in infos:
                if info.node_name == "_CREATED_BY_BARE_DDS_APP_":
                    names.add("/px4_xrce_agent")
                else:
                    names.add(f"{info.node_namespace.rstrip('/')}/{info.node_name}")
            return sorted(names)

        try:
            node = self._ensure_node()
            node_names = node.get_node_names_and_namespaces()
            topics = [
                {
                    "name": name,
                    "type": types[0],
                    "publishers": endpoint_nodes(node.get_publishers_info_by_topic(name)),
                    "subscribers": endpoint_nodes(node.get_subscriptions_info_by_topic(name)),
                }
                for name, types in node.get_topic_names_and_types()
                if types
            ]
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"ros graph unavailable: {exc}")
        return AdapterResult(
            ok=True,
            data={
                "nodes": [f"{ns.rstrip('/')}/{name}" for name, ns in node_names],
                "topics": topics,
            },
        )

    # -- lifecycle ----------------------------------------------------------

    def lifecycle_state(self, node_name: str) -> AdapterResult:
        try:
            from lifecycle_msgs.srv import GetState

            result = self._lifecycle_call(node_name, "get_state", GetState.Request())
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"get_state failed: {exc}")
        if not result.ok:
            return result
        label = result.data.current_state.label
        if label not in LIFECYCLE_STATE_LABELS:
            label = "unknown"
        return AdapterResult(ok=True, data=label)

    def lifecycle_transition(self, node_name: str, transition: str) -> AdapterResult:
        try:
            from lifecycle_msgs.msg import Transition
            from lifecycle_msgs.srv import ChangeState

            transition_ids = {
                "configure": Transition.TRANSITION_CONFIGURE,
                "cleanup": Transition.TRANSITION_CLEANUP,
                "activate": Transition.TRANSITION_ACTIVATE,
                "deactivate": Transition.TRANSITION_DEACTIVATE,
            }
            if transition == "shutdown":
                # shutdown transition id depends on the current state.
                shutdown_ids = {
                    "unconfigured": Transition.TRANSITION_UNCONFIGURED_SHUTDOWN,
                    "inactive": Transition.TRANSITION_INACTIVE_SHUTDOWN,
                    "active": Transition.TRANSITION_ACTIVE_SHUTDOWN,
                }
                state = self.lifecycle_state(node_name)
                if not state.ok or state.data not in shutdown_ids:
                    current = state.data if state.ok else "unknown"
                    return AdapterResult(ok=False, detail=f"cannot shutdown from state {current}")
                transition_id = shutdown_ids[state.data]
            elif transition in transition_ids:
                transition_id = transition_ids[transition]
            else:
                return AdapterResult(ok=False, detail=f"unknown transition {transition!r}")
            request = ChangeState.Request()
            request.transition.id = transition_id
            result = self._lifecycle_call(node_name, "change_state", request)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"change_state failed: {exc}")
        if not result.ok:
            return result
        if not result.data.success:
            return AdapterResult(ok=False, detail=f"{node_name}: {transition} rejected")
        return AdapterResult(ok=True, detail=f"{node_name}: {transition} accepted")

    def lifecycle_node_names(self) -> AdapterResult:
        # a lifecycle node reveals itself through its change_state service -
        # same derivation the ui does, so both read the same roster
        services = self.list_services()
        if not services.ok:
            return services
        suffix = "/change_state"
        return AdapterResult(
            ok=True,
            data=sorted(
                service["name"][: -len(suffix)].lstrip("/")
                for service in services.data
                if service["type"] == LIFECYCLE_CHANGE_STATE_TYPE
                and service["name"].endswith(suffix)
            ),
        )

    def release_setpoint_streams(self) -> AdapterResult:
        """Deactivate every active lifecycle node; data is the ones released.

        Every lifecycle node in this stack flies by streaming setpoints, so an
        active one owns the vehicle. Deactivating is how ownership comes back:
        the node hands px4 to AUTO.LOITER itself, before its stream stops.
        """
        names = self.lifecycle_node_names()
        if not names.ok:
            return names
        released: list[str] = []
        refused: list[str] = []
        for name in names.data:
            state = self.lifecycle_state(name)
            if not state.ok or state.data != "active":
                continue
            if self.lifecycle_transition(name, "deactivate").ok:
                released.append(name)
            else:
                refused.append(name)
        if refused:
            return AdapterResult(
                ok=False, detail=f"still streaming setpoints: {', '.join(refused)}", data=released
            )
        return AdapterResult(ok=True, data=released)

    def _await_mode_change(
        self, from_mode: str, timeout_s: float = MODE_HANDOFF_TIMEOUT_S
    ) -> None:
        # best effort: no telemetry is not a reason to refuse to land
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            telemetry = self.latest_telemetry()
            if not telemetry.ok or telemetry.data["mode"] != from_mode:
                return
            time.sleep(MODE_HANDOFF_POLL_S)

    # -- vehicle commands ---------------------------------------------------

    def _ensure_cmd_pub(self) -> Any:
        from px4_msgs.msg import VehicleCommand, VehicleCommandAck

        node = self._ensure_node()
        with self._init_lock:
            if self._cmd_pub is None:

                def on_ack(msg: Any) -> None:
                    with self._ack_cond:
                        self._acks[int(msg.command)] = msg
                        self._ack_cond.notify_all()

                for topic in (
                    "/fmu/out/vehicle_command_ack_v1",
                    "/fmu/out/vehicle_command_ack",
                ):
                    node.create_subscription(VehicleCommandAck, topic, on_ack, fmu_out_qos())
                # Same profile as the /fmu/out subscriptions: PX4's uXRCE
                # bridge subscribes /fmu/in/* with it too.
                self._cmd_pub = node.create_publisher(
                    VehicleCommand, "/fmu/in/vehicle_command", fmu_out_qos()
                )
        return self._cmd_pub

    def send_vehicle_command(
        self,
        command: int,
        param1: float = 0.0,
        param4: float = 0.0,
        param5: float = 0.0,
        param6: float = 0.0,
        param7: float = 0.0,
    ) -> AdapterResult:
        try:
            from px4_msgs.msg import VehicleCommand

            pub = self._ensure_cmd_pub()
            # Drop any previous ack for this command id so the wait below can
            # only be satisfied by a fresh one. (A TRANSIENT_LOCAL replay of a
            # pre-restart ack can theoretically race the very first command.)
            with self._ack_cond:
                self._acks.pop(command, None)
            msg = VehicleCommand()
            msg.timestamp = self._now_us()
            msg.command = command
            msg.param1 = float(param1)
            msg.param4 = float(param4)
            msg.param5 = float(param5)
            msg.param6 = float(param6)
            msg.param7 = float(param7)
            msg.target_system = 1
            msg.target_component = 1
            msg.source_system = 1
            msg.source_component = 1
            msg.from_external = True
            pub.publish(msg)
            with self._ack_cond:
                acked = self._ack_cond.wait_for(
                    lambda: command in self._acks, timeout=ACK_TIMEOUT_S
                )
                ack = self._acks.get(command)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"vehicle_command failed: {exc}")
        if not acked or ack is None:
            return AdapterResult(
                ok=False,
                detail=f"vehicle_command {command} published, no ack from PX4 "
                f"within {ACK_TIMEOUT_S}s",
            )
        ok, label = VEHICLE_CMD_RESULTS.get(int(ack.result), (False, f"result {ack.result}"))
        return AdapterResult(ok=ok, detail=f"vehicle_command {command} {label}")

    def nav_takeoff(self, altitude_m: float) -> AdapterResult:
        # NAV_TAKEOFF param7 is altitude AMSL, not height above ground. the
        # world declares its elevation (408 m in puffin.sdf), so a raw "5"
        # lands below the floor and px4's navigator ignores the command with
        # "Already higher than takeoff altitude". resolve against the ekf
        # reference altitude instead.
        try:
            self._ensure_telemetry()
            # freshness matters here: a pre-restart ref_alt resolves the
            # takeoff to an altitude the new px4 never agreed to
            local_position, _ = self._sample("local_position")
            if local_position is None:
                return AdapterResult(
                    ok=False, detail="no local position yet; cannot resolve takeoff altitude"
                )
            amsl = float(local_position.ref_alt) + float(altitude_m)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"takeoff failed: {exc}")
        # yaw/lat/lon must be nan ("use current") per mavlink convention.
        # zeros aim the takeoff waypoint at lat 0, lon 0 and the navigator
        # parks in READY_FOR_TAKEOFF until the too-slow-to-takeoff timer
        # disarms the vehicle.
        nan = float("nan")
        return self.send_vehicle_command(
            VEHICLE_CMD_NAV_TAKEOFF, param4=nan, param5=nan, param6=nan, param7=amsl
        )

    def nav_land(self) -> AdapterResult:
        # landing has to end the flight, not just lower the vehicle. an active
        # node keeps streaming setpoints all the way down, and px4 takes
        # OFFBOARD back the instant the touchdown disarm lands - leaving a
        # grounded vehicle in offboard with a stale target, so the next arm is
        # an uncommanded takeoff. release the stream first, then land.
        #
        # NAV_LAND itself needs no lat/lon: px4 reads it as "land at current
        # position" and ignores every param (unlike NAV_TAKEOFF, see above).
        released = self.release_setpoint_streams()
        if not released.ok:
            return AdapterResult(ok=False, detail=f"not landing: {released.detail}")
        if released.data:
            self._await_mode_change(from_mode="offboard")
        result = self.send_vehicle_command(VEHICLE_CMD_NAV_LAND)
        if not released.data:
            return result
        return AdapterResult(
            ok=result.ok, detail=f"{result.detail}; released {', '.join(released.data)}"
        )

    def publish_teleop(
        self, vx: float, vy: float, vz: float, yaw_rate: float = 0.0
    ) -> AdapterResult:
        # ned frame, matching the teleop node; clamping happens sim-side
        try:
            from geometry_msgs.msg import Twist

            node = self._ensure_node()
            with self._init_lock:
                if "teleop" not in self._pubs:
                    self._pubs["teleop"] = node.create_publisher(
                        Twist, "/puffin/teleop/cmd_vel", 10
                    )
            msg = Twist()
            msg.linear.x = float(vx)
            msg.linear.y = float(vy)
            msg.linear.z = float(vz)
            msg.angular.z = float(yaw_rate)
            self._pubs["teleop"].publish(msg)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"teleop publish failed: {exc}")
        return AdapterResult(ok=True)

    def _now_us(self) -> int:
        # px4_msgs timestamps are microseconds from the node clock (gotcha #7).
        return int(self._node.get_clock().now().nanoseconds // 1000)

    # -- mission ------------------------------------------------------------

    def _ensure_mission(self) -> None:
        if self._mission_ready:
            return
        from std_msgs.msg import String

        node = self._ensure_node()
        with self._init_lock:
            if self._mission_ready:
                return

            def store(msg: Any) -> None:
                # the topic has one latched publisher per executor plus the
                # host; on late join their samples replay in arbitrary order.
                # never let the host's node-less "idle" shadow a real
                # executor's status - only a fresher executor message wins
                try:
                    parsed = json.loads(msg.data)
                except json.JSONDecodeError:
                    return
                with self._data_lock:
                    current = self._latest.get("mission_status")
                    if (
                        parsed.get("node") is None
                        and current is not None
                        and current.get("node") is not None
                    ):
                        return
                    self._latest["mission_status"] = parsed

            node.create_subscription(String, "/puffin/mission/status", store, latched_qos())
            self._pubs["mission"] = node.create_publisher(
                String, "/puffin/mission", latched_qos()
            )
            self._mission_ready = True

    def publish_mission(self, mission_json: str) -> AdapterResult:
        try:
            from std_msgs.msg import String

            self._ensure_mission()
            msg = String()
            msg.data = mission_json
            self._pubs["mission"].publish(msg)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"mission publish failed: {exc}")
        return AdapterResult(ok=True, detail="mission latched; activate mission_node to fly")

    def mission_status(self) -> AdapterResult:
        try:
            self._ensure_mission()
            with self._data_lock:
                status = self._latest.get("mission_status")
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"mission status unavailable: {exc}")
        if status is None:
            # nothing published yet - mission host not up or nothing primed
            return AdapterResult(
                ok=True,
                data={"state": "idle", "current_index": None, "total": 0,
                      "detail": "no mission status yet"},
            )
        return AdapterResult(ok=True, data=status)

    # -- telemetry ----------------------------------------------------------

    def _ensure_telemetry(self) -> None:
        if self._telemetry_ready:
            return
        from px4_msgs.msg import (
            BatteryStatus,
            VehicleAttitude,
            VehicleLocalPosition,
            VehicleStatus,
        )

        node = self._ensure_node()
        with self._init_lock:
            if self._telemetry_ready:
                return

            prefix = "NAVIGATION_STATE_"
            self._nav_states = {
                value: name.removeprefix(prefix).lower()
                for name, value in vars(VehicleStatus).items()
                if name.startswith(prefix) and isinstance(value, int)
            }

            def subscribe(kind: str, msg_type: Any, base: str) -> None:
                def store(msg: Any, kind: str = kind) -> None:
                    with self._data_lock:
                        self._latest[kind] = msg
                        # arrival time, not msg.timestamp: the px4 clock
                        # restarts with px4, ours does not
                        self._received_at[kind] = time.monotonic()

                # PX4 assigns versions some topics  and the set grows across releases
                # subscribe to all releases only one topic publishes
                for topic in (f"/fmu/out/{base}_v1", f"/fmu/out/{base}"):
                    node.create_subscription(msg_type, topic, store, fmu_out_qos())

            subscribe("status", VehicleStatus, "vehicle_status")
            subscribe("local_position", VehicleLocalPosition, "vehicle_local_position")
            subscribe("battery", BatteryStatus, "battery_status")
            subscribe("attitude", VehicleAttitude, "vehicle_attitude")
            self._telemetry_ready = True

    def _sample(self, kind: str) -> tuple[Any, float | None]:
        """The last sample of `kind` with its age, or (None, None) if none ever
        arrived. Older than the stale window comes back as (None, age): px4 is
        down or restarting, and its last words are not the vehicle's state."""
        with self._data_lock:
            sample = self._latest.get(kind)
            received = self._received_at.get(kind)
        if sample is None or received is None:
            return None, None
        age = time.monotonic() - received
        return (None if age > TELEMETRY_STALE_S else sample), age

    def latest_telemetry(self) -> AdapterResult:
        try:
            from px4_msgs.msg import VehicleStatus

            self._ensure_telemetry()
            status, age = self._sample("status")
            local_position, _ = self._sample("local_position")
            battery, _ = self._sample("battery")
            attitude, _ = self._sample("attitude")
            if status is None:
                if age is None:
                    return AdapterResult(ok=False, detail="no telemetry received yet")
                return AdapterResult(
                    ok=False,
                    detail=f"telemetry stale: no vehicle_status for {age:.1f}s",
                )
            sample = {
                "t_us": int(status.timestamp),
                "armed": bool(status.arming_state == VehicleStatus.ARMING_STATE_ARMED),
                "mode": self._nav_states.get(status.nav_state, f"nav_state_{status.nav_state}"),
                "ned": {
                    "x": float(local_position.x) if local_position else 0.0,
                    "y": float(local_position.y) if local_position else 0.0,
                    "z": float(local_position.z) if local_position else 0.0,
                },
                "battery_v": float(battery.voltage_v) if battery else 0.0,
                # px4 q is [w, x, y, z], body FRD -> NED
                "attitude_q": (
                    [float(value) for value in attitude.q]
                    if attitude is not None
                    else [1.0, 0.0, 0.0, 0.0]
                ),
            }
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"telemetry unavailable: {exc}")
        return AdapterResult(ok=True, data=sample)


def world_name() -> str:
    return os.environ.get("PUFFIN_WORLD", "puffin")
