"""Wrapper around rclpy. The only place that talks to ROS 2.

rclpy only exists inside the ROS-based containers, so every ROS import stays
inside a method body; on any failure methods degrade to a clean {ok, detail}.

One node is created lazily and spun by a background executor thread for the
life of the process. Graph queries need no spinning, but the node must be
long-lived anyway: DDS discovery is gossip, and a fresh node knows nothing.
"""

import os
import threading
from typing import Any

from . import AdapterResult

# VehicleCommand command ids (px4_msgs constants, stable across PX4 releases).
VEHICLE_CMD_NAV_LAND = 21
VEHICLE_CMD_NAV_TAKEOFF = 22
VEHICLE_CMD_ARM_DISARM = 400

LIFECYCLE_CALL_TIMEOUT_S = 3.0
LIFECYCLE_STATE_LABELS = {"unconfigured", "inactive", "active", "finalized"}


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


class RosAdapter:
    def __init__(self) -> None:
        self._init_lock = threading.Lock()
        self._data_lock = threading.Lock()
        self._node: Any = None
        self._executor: Any = None
        self._cmd_pub: Any = None
        self._clients: dict[str, Any] = {}
        self._latest: dict[str, Any] = {}
        self._nav_states: dict[int, str] = {}
        self._telemetry_ready = False

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

    def _lifecycle_client(self, node_name: str, service: str) -> Any:
        from lifecycle_msgs.srv import ChangeState, GetState

        node = self._ensure_node()
        service_name = f"/{node_name.strip('/')}/{service}"
        with self._init_lock:
            client = self._clients.get(service_name)
            if client is None:
                srv_type = GetState if service == "get_state" else ChangeState
                client = node.create_client(srv_type, service_name)
                self._clients[service_name] = client
        return client

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
        try:
            node = self._ensure_node()
            node_names = node.get_node_names_and_namespaces()
            topic_names = node.get_topic_names_and_types()
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"ros graph unavailable: {exc}")
        return AdapterResult(
            ok=True,
            data={
                "nodes": [f"{ns.rstrip('/')}/{name}" for name, ns in node_names],
                "topics": [
                    {"name": name, "type": types[0]} for name, types in topic_names if types
                ],
            },
        )

    # -- lifecycle ----------------------------------------------------------

    def lifecycle_state(self, node_name: str) -> AdapterResult:
        try:
            from lifecycle_msgs.srv import GetState

            client = self._lifecycle_client(node_name, "get_state")
            if not client.wait_for_service(timeout_sec=1.0):
                return AdapterResult(ok=False, detail=f"/{node_name}/get_state not available")
            response = self._call(client, GetState.Request())
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"get_state failed: {exc}")
        label = response.current_state.label
        if label not in LIFECYCLE_STATE_LABELS:
            label = "unknown"
        return AdapterResult(ok=True, data=label)

    def lifecycle_transition(self, node_name: str, transition: str) -> AdapterResult:
        try:
            from lifecycle_msgs.msg import Transition
            from lifecycle_msgs.srv import ChangeState

            client = self._lifecycle_client(node_name, "change_state")
            if not client.wait_for_service(timeout_sec=1.0):
                return AdapterResult(ok=False, detail=f"/{node_name}/change_state not available")
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
            response = self._call(client, request)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"change_state failed: {exc}")
        if not response.success:
            return AdapterResult(ok=False, detail=f"{node_name}: {transition} rejected")
        return AdapterResult(ok=True, detail=f"{node_name}: {transition} accepted")

    # -- vehicle commands ---------------------------------------------------

    def send_vehicle_command(
        self, command: int, param1: float = 0.0, param7: float = 0.0
    ) -> AdapterResult:
        try:
            from px4_msgs.msg import VehicleCommand

            node = self._ensure_node()
            with self._init_lock:
                if self._cmd_pub is None:
                    # Same profile as the /fmu/out subscriptions: PX4's uXRCE
                    # bridge subscribes /fmu/in/* with it too.
                    self._cmd_pub = node.create_publisher(
                        VehicleCommand, "/fmu/in/vehicle_command", fmu_out_qos()
                    )
            msg = VehicleCommand()
            msg.timestamp = self._now_us()
            msg.command = command
            msg.param1 = float(param1)
            msg.param7 = float(param7)
            msg.target_system = 1
            msg.target_component = 1
            msg.source_system = 1
            msg.source_component = 1
            msg.from_external = True
            self._cmd_pub.publish(msg)
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"vehicle_command failed: {exc}")
        return AdapterResult(ok=True, detail=f"vehicle_command {command} published")

    def _now_us(self) -> int:
        # px4_msgs timestamps are microseconds from the node clock (gotcha #7).
        return int(self._node.get_clock().now().nanoseconds // 1000)

    # -- telemetry ----------------------------------------------------------

    def _ensure_telemetry(self) -> None:
        if self._telemetry_ready:
            return
        from px4_msgs.msg import BatteryStatus, VehicleLocalPosition, VehicleStatus

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

                # PX4 assigns versions some topics  and the set grows across releases
                # subscribe to all releases only one topic publishes
                for topic in (f"/fmu/out/{base}_v1", f"/fmu/out/{base}"):
                    node.create_subscription(msg_type, topic, store, fmu_out_qos())

            subscribe("status", VehicleStatus, "vehicle_status")
            subscribe("local_position", VehicleLocalPosition, "vehicle_local_position")
            subscribe("battery", BatteryStatus, "battery_status")
            self._telemetry_ready = True

    def latest_telemetry(self) -> AdapterResult:
        try:
            from px4_msgs.msg import VehicleStatus

            self._ensure_telemetry()
            with self._data_lock:
                status = self._latest.get("status")
                local_position = self._latest.get("local_position")
                battery = self._latest.get("battery")
            if status is None:
                return AdapterResult(ok=False, detail="no telemetry received yet")
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
            }
        except Exception as exc:  # noqa: BLE001 - clean {ok, detail} at the boundary
            return AdapterResult(ok=False, detail=f"telemetry unavailable: {exc}")
        return AdapterResult(ok=True, data=sample)


def world_name() -> str:
    return os.environ.get("PUFFIN_WORLD", "puffin")
