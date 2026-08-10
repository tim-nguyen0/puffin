from fastapi.testclient import TestClient

from puffin_api.adapters.ros_node import VEHICLE_CMD_ARM_DISARM
from tests.conftest import FakeRos


def test_arm_publishes_arm_command(client: TestClient, fake_ros: FakeRos) -> None:
    assert client.post("/api/vehicle/arm").json()["ok"] is True
    assert fake_ros.commands == [(VEHICLE_CMD_ARM_DISARM, 1.0, 0.0)]


def test_disarm_publishes_disarm_command(client: TestClient, fake_ros: FakeRos) -> None:
    assert client.post("/api/vehicle/disarm").json()["ok"] is True
    assert fake_ros.commands == [(VEHICLE_CMD_ARM_DISARM, 0.0, 0.0)]


def test_takeoff_passes_altitude(client: TestClient, fake_ros: FakeRos) -> None:
    response = client.post("/api/vehicle/takeoff", json={"altitude_m": 5.0})
    assert response.json()["ok"] is True
    # relative altitude goes to the adapter, which owns the AMSL conversion
    assert fake_ros.takeoffs == [5.0]


def test_takeoff_rejects_out_of_range_altitude(client: TestClient) -> None:
    assert client.post("/api/vehicle/takeoff", json={"altitude_m": 500}).status_code == 422


def test_land(client: TestClient, fake_ros: FakeRos) -> None:
    # land goes through the adapter, not a bare command: it has to release the
    # setpoint stream on the way down
    assert client.post("/api/vehicle/land").json()["ok"] is True
    assert (fake_ros.lands, fake_ros.commands) == (1, [])
