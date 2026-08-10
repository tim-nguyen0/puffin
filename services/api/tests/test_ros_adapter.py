"""RosAdapter behaviour around processes that come and go.

rclpy is not importable outside the ros containers, so these tests stand in
fake lifecycle_msgs/px4_msgs modules and a fake node: what is under test is
the adapter's own bookkeeping - which client it uses, when it throws one
away, and how old a sample it is willing to call telemetry.
"""

import sys
import time
import types
from typing import Any

import pytest

from puffin_api.adapters import AdapterResult
from puffin_api.adapters.ros_node import (
    TELEMETRY_STALE_S,
    VEHICLE_CMD_NAV_LAND,
    RosAdapter,
)

# -- fake ros ---------------------------------------------------------------


class FakeFuture:
    def __init__(self, response: Any, completes: bool = True) -> None:
        self._response = response
        self._completes = completes

    def add_done_callback(self, callback: Any) -> None:
        if self._completes:
            callback(self)

    def result(self) -> Any:
        return self._response


class FakeClient:
    """One lifecycle client. `available` is what discovery reports, `answers`
    is whether the process behind it actually replies."""

    def __init__(self, service_name: str, available: bool = True, answers: bool = True) -> None:
        self.service_name = service_name
        self.available = available
        self.answers = answers
        self.response: Any = None
        self.calls = 0
        self.removed: list[Any] = []
        self.destroyed = False

    def wait_for_service(self, timeout_sec: float = 1.0) -> bool:
        return self.available

    def call_async(self, request: Any) -> FakeFuture:
        self.calls += 1
        if not self.answers:
            raise RuntimeError("client handle is invalid")
        return FakeFuture(self.response)

    def remove_pending_request(self, future: Any) -> None:
        self.removed.append(future)


class FakeNode:
    def __init__(self) -> None:
        self.clients: list[FakeClient] = []
        self.destroyed: list[FakeClient] = []
        # per service name: what the next created client should behave like
        self.available = True
        self.answers = True
        # node name -> lifecycle state; anything absent reads "inactive"
        self.states: dict[str, str] = {}
        # node names that refuse every transition
        self.refuses: set[str] = set()

    def create_client(self, srv_type: Any, service_name: str) -> FakeClient:
        client = FakeClient(service_name, available=self.available, answers=self.answers)
        node_name = service_name.strip("/").rsplit("/", 1)[0]
        # a healthy node: inactive, and it accepts what it is asked to do
        client.response = (
            state_response(self.states.get(node_name, "inactive"))
            if service_name.endswith("get_state")
            else change_response(node_name not in self.refuses)
        )
        self.clients.append(client)
        return client

    def destroy_client(self, client: FakeClient) -> None:
        client.destroyed = True
        self.destroyed.append(client)

    def get_service_names_and_types(self) -> list[tuple[str, list[str]]]:
        services: list[tuple[str, list[str]]] = []
        for name in self.states:
            services.append((f"/{name}/change_state", ["lifecycle_msgs/srv/ChangeState"]))
            services.append((f"/{name}/get_state", ["lifecycle_msgs/srv/GetState"]))
        return services


def state_response(label: str) -> Any:
    return types.SimpleNamespace(current_state=types.SimpleNamespace(label=label))


def change_response(success: bool) -> Any:
    return types.SimpleNamespace(success=success)


@pytest.fixture(autouse=True)
def fake_ros_msgs() -> Any:
    """Stand in for the message packages the adapter imports lazily."""

    def request_factory() -> Any:
        return types.SimpleNamespace(transition=types.SimpleNamespace(id=0))

    lifecycle = types.ModuleType("lifecycle_msgs")
    srv = types.ModuleType("lifecycle_msgs.srv")
    srv.GetState = types.SimpleNamespace(Request=lambda: types.SimpleNamespace())
    srv.ChangeState = types.SimpleNamespace(Request=request_factory)
    msg = types.ModuleType("lifecycle_msgs.msg")
    msg.Transition = types.SimpleNamespace(
        TRANSITION_CONFIGURE=1,
        TRANSITION_CLEANUP=2,
        TRANSITION_ACTIVATE=3,
        TRANSITION_DEACTIVATE=4,
        TRANSITION_UNCONFIGURED_SHUTDOWN=5,
        TRANSITION_INACTIVE_SHUTDOWN=6,
        TRANSITION_ACTIVE_SHUTDOWN=7,
    )

    px4 = types.ModuleType("px4_msgs")
    px4_msg = types.ModuleType("px4_msgs.msg")
    px4_msg.VehicleStatus = types.SimpleNamespace(ARMING_STATE_ARMED=2)

    added = {
        "lifecycle_msgs": lifecycle,
        "lifecycle_msgs.srv": srv,
        "lifecycle_msgs.msg": msg,
        "px4_msgs": px4,
        "px4_msgs.msg": px4_msg,
    }
    sys.modules.update(added)
    yield
    for name in added:
        sys.modules.pop(name, None)


@pytest.fixture
def node() -> FakeNode:
    return FakeNode()


@pytest.fixture
def adapter(node: FakeNode) -> RosAdapter:
    ros = RosAdapter()
    # a node already exists, so nothing reaches rclpy
    ros._node = node
    ros._telemetry_ready = True
    return ros


def store(adapter: RosAdapter, kind: str, sample: Any, age_s: float = 0.0) -> None:
    adapter._latest[kind] = sample
    adapter._received_at[kind] = time.monotonic() - age_s


# -- lifecycle: a node that is gone ------------------------------------------


def test_dead_node_reports_not_available(adapter: RosAdapter, node: FakeNode) -> None:
    node.available = False
    result = adapter.lifecycle_state("patrol_demo")
    assert result.ok is False
    assert result.detail == "/patrol_demo/get_state not available"


def test_dead_node_drops_its_client(adapter: RosAdapter, node: FakeNode) -> None:
    # the ui polls a forged node that has autokilled; nothing may be left
    # bound to the process that is gone
    node.available = False
    adapter.lifecycle_state("patrol_demo")
    assert adapter._lifecycle_clients == {}
    assert node.destroyed == node.clients


def test_service_in_graph_but_nobody_answers(adapter: RosAdapter, node: FakeNode) -> None:
    # discovery lags a dying node: the call fails rather than the wait
    node.answers = False
    result = adapter.lifecycle_state("patrol_demo")
    assert result.ok is False
    assert result.detail.startswith("/patrol_demo/get_state not available:")
    assert adapter._lifecycle_clients == {}


def test_restarted_node_answers_on_the_next_poll(adapter: RosAdapter, node: FakeNode) -> None:
    # the reported bug: exit -> supervisorctl start -> the ui must read the
    # new process, not the binding the old one left behind
    node.available = False
    assert adapter.lifecycle_state("patrol_demo").ok is False

    node.available = True
    result = adapter.lifecycle_state("patrol_demo")
    assert (result.ok, result.data) == (True, "inactive")
    assert len(node.clients) == 2, "the dead client must not be reused"


def test_transition_after_a_replay(adapter: RosAdapter, node: FakeNode) -> None:
    node.available = False
    dead = adapter.lifecycle_transition("patrol_demo", "activate")
    assert (dead.ok, dead.detail) == (False, "/patrol_demo/change_state not available")

    node.available = True
    result = adapter.lifecycle_transition("patrol_demo", "activate")
    assert result.ok is True
    assert result.detail == "patrol_demo: activate accepted"
    assert len(node.clients) == 2, "the dead client must not be reused"


# -- lifecycle: a node that is alive -----------------------------------------


def test_live_node_reuses_one_client(adapter: RosAdapter, node: FakeNode) -> None:
    for _ in range(3):
        assert adapter.lifecycle_state("patrol_demo").data == "inactive"
    assert len(node.clients) == 1
    assert node.destroyed == []


def test_rejected_transition_keeps_the_client(adapter: RosAdapter, node: FakeNode) -> None:
    # a node that answers "no" is alive; churn handling must not confuse a
    # refusal with a disappearance
    adapter.lifecycle_state("patrol_demo")
    client = adapter._lifecycle_client("/patrol_demo/change_state", "change_state")
    client.response = change_response(False)
    result = adapter.lifecycle_transition("patrol_demo", "activate")
    assert result.ok is False
    assert result.detail == "patrol_demo: activate rejected"
    assert "/patrol_demo/change_state" in adapter._lifecycle_clients
    assert client.destroyed is False


def test_unrecognised_state_label_is_unknown(adapter: RosAdapter, node: FakeNode) -> None:
    adapter.lifecycle_state("patrol_demo")
    client = adapter._lifecycle_clients["/patrol_demo/get_state"]
    client.response = state_response("errorprocessing")
    assert adapter.lifecycle_state("patrol_demo").data == "unknown"


def test_call_timeout_unblocks_and_cleans_up(adapter: RosAdapter) -> None:
    client = FakeClient("/patrol_demo/get_state")
    future = FakeFuture(None, completes=False)
    client.call_async = lambda request: future  # type: ignore[assignment]
    with pytest.raises(TimeoutError):
        adapter._call(client, object(), timeout_s=0.05)
    assert client.removed == [future]


# -- telemetry: samples outlive the px4 that produced them --------------------


def vehicle_status(armed: bool = True) -> Any:
    return types.SimpleNamespace(timestamp=1234, arming_state=2 if armed else 1, nav_state=4)


def test_telemetry_never_received(adapter: RosAdapter) -> None:
    result = adapter.latest_telemetry()
    assert result.ok is False
    assert result.detail == "no telemetry received yet"


def test_fresh_telemetry_is_served(adapter: RosAdapter) -> None:
    store(adapter, "status", vehicle_status())
    result = adapter.latest_telemetry()
    assert result.ok is True
    assert result.data["armed"] is True
    assert result.data["t_us"] == 1234


def test_stale_telemetry_is_not_served(adapter: RosAdapter) -> None:
    # px4 restarted for a vehicle swap; the old airframe's last frame must not
    # keep streaming as the new one's state
    store(adapter, "status", vehicle_status(), age_s=TELEMETRY_STALE_S + 1)
    result = adapter.latest_telemetry()
    assert result.ok is False
    assert result.detail.startswith("telemetry stale: no vehicle_status for")


def test_stale_position_drops_out_of_a_fresh_sample(adapter: RosAdapter) -> None:
    store(adapter, "status", vehicle_status())
    store(
        adapter,
        "local_position",
        types.SimpleNamespace(x=5.0, y=6.0, z=-7.0, ref_alt=400.0),
        age_s=TELEMETRY_STALE_S + 1,
    )
    assert adapter.latest_telemetry().data["ned"] == {"x": 0.0, "y": 0.0, "z": 0.0}


# -- land: the flight has to end, not just descend ---------------------------


def trace_land(adapter: RosAdapter) -> list[str]:
    """One ordered log across both halves of a land - releasing the setpoint
    stream and the command itself - so a test can assert they happen in that
    order and not the other one."""
    trace: list[str] = []
    transition = adapter.lifecycle_transition

    def traced_transition(node_name: str, name: str) -> Any:
        result = transition(node_name, name)
        trace.append(f"{name} {node_name}" if result.ok else f"{name} {node_name} refused")
        return result

    def traced_command(command: int, **params: float) -> AdapterResult:
        trace.append(f"command {command}")
        return AdapterResult(ok=True, detail=f"vehicle_command {command} accepted")

    adapter.lifecycle_transition = traced_transition  # type: ignore[method-assign]
    adapter.send_vehicle_command = traced_command  # type: ignore[method-assign]
    return trace


def test_land_releases_the_streaming_node_first(adapter: RosAdapter, node: FakeNode) -> None:
    # the reported bug: land while offboard_demo streams and px4 lands, then
    # takes OFFBOARD straight back on the touchdown disarm - so the next arm
    # flies. the stream has to be let go before the vehicle comes down.
    node.states = {"offboard_demo": "active", "teleop": "inactive"}
    trace = trace_land(adapter)

    result = adapter.nav_land()

    assert trace == ["deactivate offboard_demo", f"command {VEHICLE_CMD_NAV_LAND}"]
    assert result.ok is True
    assert result.detail.endswith("released offboard_demo")


def test_land_releases_every_active_node(adapter: RosAdapter, node: FakeNode) -> None:
    # a mission executor and the demo can both be active; either one left
    # streaming is enough to reclaim the vehicle
    node.states = {"mission_1": "active", "offboard_demo": "active", "teleop": "inactive"}
    trace = trace_land(adapter)

    assert adapter.nav_land().ok is True
    assert trace == [
        "deactivate mission_1",
        "deactivate offboard_demo",
        f"command {VEHICLE_CMD_NAV_LAND}",
    ]


def test_land_with_nothing_streaming_is_just_the_command(
    adapter: RosAdapter, node: FakeNode
) -> None:
    node.states = {"offboard_demo": "inactive", "teleop": "inactive"}
    trace = trace_land(adapter)

    result = adapter.nav_land()

    assert trace == [f"command {VEHICLE_CMD_NAV_LAND}"]
    assert result.detail == f"vehicle_command {VEHICLE_CMD_NAV_LAND} accepted"


def test_land_refuses_when_a_node_will_not_release(adapter: RosAdapter, node: FakeNode) -> None:
    # landing under a stream that would not let go is the bug, not the fix:
    # say so instead of commanding a descent the node will fly back out of
    node.states = {"offboard_demo": "active"}
    node.refuses = {"offboard_demo"}
    trace = trace_land(adapter)

    result = adapter.nav_land()

    assert trace == ["deactivate offboard_demo refused"]
    assert result.ok is False
    assert result.detail == "not landing: still streaming setpoints: offboard_demo"


def test_land_waits_for_the_loiter_handoff(adapter: RosAdapter, node: FakeNode) -> None:
    # deactivate makes the node hand px4 to AUTO.LOITER, but that command and
    # this one come from different publishers - land before it applies and the
    # loiter cancels the landing
    node.states = {"offboard_demo": "active"}
    modes = ["offboard", "offboard", "auto_loiter"]
    seen: list[str] = []

    def telemetry() -> AdapterResult:
        mode = modes[len(seen)] if len(seen) < len(modes) else modes[-1]
        seen.append(mode)
        return AdapterResult(ok=True, data={"mode": mode})

    adapter.latest_telemetry = telemetry  # type: ignore[method-assign]
    trace_land(adapter)

    assert adapter.nav_land().ok is True
    assert seen == ["offboard", "offboard", "auto_loiter"]


def test_takeoff_refuses_a_stale_reference_altitude(adapter: RosAdapter) -> None:
    store(
        adapter,
        "local_position",
        types.SimpleNamespace(x=0.0, y=0.0, z=0.0, ref_alt=408.0),
        age_s=TELEMETRY_STALE_S + 1,
    )
    result = adapter.nav_takeoff(5.0)
    assert result.ok is False
    assert result.detail == "no local position yet; cannot resolve takeoff altitude"
