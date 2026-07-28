import pytest
from fastapi.testclient import TestClient

from puffin_api.adapters import AdapterResult
from puffin_api.main import create_app


class FakeSupervisor:
    def __init__(self) -> None:
        self.procs = [
            {"name": "gz-server", "state": "RUNNING", "uptime_s": 120},
            {"name": "gz-gui", "state": "RUNNING", "uptime_s": 118},
            {"name": "xrce-agent", "state": "RUNNING", "uptime_s": 117},
            {"name": "px4", "state": "RUNNING", "uptime_s": 115},
        ]
        self.calls: list[str] = []

    def list_processes(self) -> AdapterResult:
        return AdapterResult(ok=True, data=self.procs)

    def start_sim(self) -> AdapterResult:
        self.calls.append("start")
        return AdapterResult(ok=True, detail="started: gz-server, gz-gui, xrce-agent, px4")

    def stop_sim(self) -> AdapterResult:
        self.calls.append("stop")
        return AdapterResult(ok=True, detail="stopped: px4, xrce-agent, gz-gui, gz-server")


class FakeRos:
    def __init__(self) -> None:
        self.commands: list[tuple[int, float, float]] = []
        self.transitions: list[tuple[str, str]] = []
        self.lifecycle = {"offboard_demo": "inactive"}

    def send_vehicle_command(
        self, command: int, param1: float = 0.0, param7: float = 0.0
    ) -> AdapterResult:
        self.commands.append((command, param1, param7))
        return AdapterResult(ok=True, detail=f"vehicle_command {command} published")

    def list_services(self) -> AdapterResult:
        return AdapterResult(
            ok=True,
            data=[
                {"name": "/offboard_demo/change_state", "type": "lifecycle_msgs/srv/ChangeState"},
                {"name": "/offboard_demo/get_state", "type": "lifecycle_msgs/srv/GetState"},
            ],
        )

    def graph(self) -> AdapterResult:
        return AdapterResult(
            ok=True,
            data={
                "nodes": ["/puffin_api", "/offboard_demo"],
                "topics": [
                    {
                        "name": "/fmu/out/vehicle_status_v1",
                        "type": "px4_msgs/msg/VehicleStatus",
                    }
                ],
            },
        )

    def lifecycle_state(self, node_name: str) -> AdapterResult:
        state = self.lifecycle.get(node_name)
        if state is None:
            return AdapterResult(ok=False, detail=f"/{node_name}/get_state not available")
        return AdapterResult(ok=True, data=state)

    def lifecycle_transition(self, node_name: str, transition: str) -> AdapterResult:
        if node_name not in self.lifecycle:
            return AdapterResult(ok=False, detail=f"/{node_name}/change_state not available")
        self.transitions.append((node_name, transition))
        if transition == "activate":
            self.lifecycle[node_name] = "active"
        return AdapterResult(ok=True, detail=f"{node_name}: {transition} accepted")

    def latest_telemetry(self) -> AdapterResult:
        return AdapterResult(ok=False, detail="no telemetry received yet")


@pytest.fixture
def fake_supervisor() -> FakeSupervisor:
    return FakeSupervisor()


@pytest.fixture
def fake_ros() -> FakeRos:
    return FakeRos()


@pytest.fixture
def client(fake_supervisor: FakeSupervisor, fake_ros: FakeRos) -> TestClient:
    app = create_app(supervisor=fake_supervisor, ros_adapter=fake_ros)
    return TestClient(app)
