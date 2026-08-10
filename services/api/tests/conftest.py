from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from puffin_api.adapters import AdapterResult
from puffin_api.adapters.forge import ForgeAdapter
from puffin_api.adapters.vehicle_env import VehicleEnvAdapter
from puffin_api.main import create_app


class FakeSupervisor:
    # trace is shared with FakeGz so a test can assert the order of a
    # sequence that crosses both adapters (see test_replace_vehicle)
    def __init__(self, trace: list[str] | None = None) -> None:
        self.procs = [
            {"name": "gz-server", "state": "RUNNING", "uptime_s": 120},
            {"name": "gz-gui", "state": "RUNNING", "uptime_s": 118},
            {"name": "xrce-agent", "state": "RUNNING", "uptime_s": 117},
            {"name": "px4", "state": "RUNNING", "uptime_s": 115},
        ]
        self.calls: list[str] = []
        self.trace = trace if trace is not None else []
        self.stop_error: str | None = None
        self.start_error: str | None = None
        self.list_error: str | None = None
        self.restart_errors: dict[str, str] = {}

    def list_processes(self) -> AdapterResult:
        if self.list_error is not None:
            return AdapterResult(ok=False, detail=self.list_error)
        return AdapterResult(ok=True, data=self.procs)

    def start_sim(self) -> AdapterResult:
        self.calls.append("start")
        return AdapterResult(ok=True, detail="started: gz-server, gz-gui, xrce-agent, px4")

    def stop_sim(self) -> AdapterResult:
        self.calls.append("stop")
        return AdapterResult(ok=True, detail="stopped: px4, xrce-agent, gz-gui, gz-server")

    def start_program(self, name: str) -> AdapterResult:
        self.trace.append(f"start {name}")
        if self.start_error is not None:
            return AdapterResult(ok=False, detail=self.start_error)
        return AdapterResult(ok=True, detail=f"started: {name}")

    def stop_program(self, name: str) -> AdapterResult:
        self.trace.append(f"stop {name}")
        if self.stop_error is not None:
            return AdapterResult(ok=False, detail=self.stop_error)
        return AdapterResult(ok=True, detail=f"stopped: {name}")

    def restart_program(self, name: str) -> AdapterResult:
        self.trace.append(f"restart {name}")
        if name in self.restart_errors:
            return AdapterResult(ok=False, detail=self.restart_errors[name])
        return AdapterResult(ok=True, detail=f"restarted: {name}")


class FakeRos:
    def __init__(self) -> None:
        self.commands: list[tuple[int, float, float]] = []
        self.takeoffs: list[float] = []
        self.lands = 0
        self.transitions: list[tuple[str, str]] = []
        self.lifecycle = {"offboard_demo": "inactive"}
        self.telemetry: dict | None = None
        self.teleop_frames: list[tuple[float, float, float, float]] = []
        self.missions: list[str] = []
        self.mission_state: dict | None = None

    def send_vehicle_command(
        self, command: int, param1: float = 0.0, param7: float = 0.0
    ) -> AdapterResult:
        self.commands.append((command, param1, param7))
        return AdapterResult(ok=True, detail=f"vehicle_command {command} published")

    def nav_takeoff(self, altitude_m: float) -> AdapterResult:
        self.takeoffs.append(altitude_m)
        return AdapterResult(ok=True, detail="vehicle_command 22 published")

    def nav_land(self) -> AdapterResult:
        # the release-then-land sequence lives in the real adapter; see
        # test_ros_adapter
        self.lands += 1
        return AdapterResult(ok=True, detail="vehicle_command 21 published")

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
                        "publishers": ["/px4_xrce_agent"],
                        "subscribers": ["/puffin_api"],
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

    def publish_teleop(
        self, vx: float, vy: float, vz: float, yaw_rate: float = 0.0
    ) -> AdapterResult:
        self.teleop_frames.append((vx, vy, vz, yaw_rate))
        return AdapterResult(ok=True)

    def latest_telemetry(self) -> AdapterResult:
        if self.telemetry is None:
            return AdapterResult(ok=False, detail="no telemetry received yet")
        return AdapterResult(ok=True, data=self.telemetry)

    def publish_mission(self, mission_json: str) -> AdapterResult:
        self.missions.append(mission_json)
        return AdapterResult(ok=True, detail="mission latched; activate mission_node to fly")

    def mission_status(self) -> AdapterResult:
        if self.mission_state is None:
            return AdapterResult(
                ok=True,
                data={"state": "idle", "current_index": None, "total": 0,
                      "detail": "no mission status yet"},
            )
        return AdapterResult(ok=True, data=self.mission_state)


class FakeGz:
    def __init__(self, trace: list[str] | None = None) -> None:
        self.resets = 0
        self.poses: list[tuple[float, float, float, float]] = []
        self.removed: list[str] = []
        self.trace = trace if trace is not None else []
        self.remove_error: str | None = None
        self.world_ready_error: str | None = None

    def reset_world(self) -> AdapterResult:
        self.resets += 1
        return AdapterResult(ok=True, detail="world puffin reset")

    def world_ready(self, timeout_s: float = 20.0) -> AdapterResult:
        self.trace.append("await world")
        if self.world_ready_error is not None:
            return AdapterResult(ok=False, detail=self.world_ready_error)
        return AdapterResult(ok=True, detail="world puffin is up")

    def remove_entity(self, name: str) -> AdapterResult:
        self.trace.append(f"remove {name}")
        if self.remove_error is not None:
            return AdapterResult(ok=False, detail=self.remove_error)
        self.removed.append(name)
        return AdapterResult(ok=True, detail=f"{name} removed from world puffin")

    def set_vehicle_pose(
        self, x: float, y: float, z: float = 0.3, yaw_deg: float = 0.0
    ) -> AdapterResult:
        self.poses.append((x, y, z, yaw_deg))
        return AdapterResult(ok=True, detail=f"x500_0 moved to ({x}, {y}, {z})")


@pytest.fixture
def call_trace() -> list[str]:
    # one ordered log for the adapters a single request drives in sequence
    return []


@pytest.fixture
def fake_supervisor(call_trace: list[str]) -> FakeSupervisor:
    return FakeSupervisor(call_trace)


@pytest.fixture
def fake_ros() -> FakeRos:
    return FakeRos()


@pytest.fixture
def fake_gz(call_trace: list[str]) -> FakeGz:
    return FakeGz(call_trace)


@pytest.fixture
def forge_dir(tmp_path: Path) -> Path:
    return tmp_path / "forge"


@pytest.fixture
def forge_adapter(forge_dir: Path) -> ForgeAdapter:
    # the real adapter, pointed at an isolated tmp dir - forge is just
    # filesystem plumbing, no need to fake it
    return ForgeAdapter(str(forge_dir))


@pytest.fixture
def vehicle_env_path(tmp_path: Path) -> Path:
    return tmp_path / "shm" / "vehicle.env"


@pytest.fixture
def vehicle_env_adapter(vehicle_env_path: Path) -> VehicleEnvAdapter:
    # real adapter on a tmp path, same reasoning as forge: it is only a file
    return VehicleEnvAdapter(str(vehicle_env_path))


@pytest.fixture
def client(
    fake_supervisor: FakeSupervisor,
    fake_ros: FakeRos,
    fake_gz: FakeGz,
    forge_adapter: ForgeAdapter,
    vehicle_env_adapter: VehicleEnvAdapter,
    tmp_path: Path,
) -> TestClient:
    app = create_app(
        supervisor=fake_supervisor,
        ros_adapter=fake_ros,
        gz=fake_gz,
        forge=forge_adapter,
        vehicle_env=vehicle_env_adapter,
        db_path=str(tmp_path / "test.db"),
    )
    return TestClient(app)
