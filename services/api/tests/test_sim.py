from fastapi.testclient import TestClient

from tests.conftest import FakeGz, FakeRos, FakeSupervisor


def test_sim_status_running_when_all_programs_up(client: TestClient) -> None:
    response = client.get("/api/sim/status")
    assert response.status_code == 200
    body = response.json()
    assert body["running"] is True
    assert body["world"] == "puffin"
    assert {p["name"] for p in body["processes"]} == {"gz-server", "gz-gui", "xrce-agent", "px4"}


def test_sim_status_not_running_when_px4_down(
    client: TestClient, fake_supervisor: FakeSupervisor
) -> None:
    fake_supervisor.procs[-1] = {"name": "px4", "state": "FATAL", "uptime_s": 0}
    body = client.get("/api/sim/status").json()
    assert body["running"] is False


def test_start_and_stop_hit_supervisor(client: TestClient, fake_supervisor: FakeSupervisor) -> None:
    assert client.post("/api/sim/start").json()["ok"] is True
    assert client.post("/api/sim/stop").json()["ok"] is True
    assert fake_supervisor.calls == ["start", "stop"]


def test_procs_lists_process_table(client: TestClient) -> None:
    body = client.get("/api/procs").json()
    assert len(body) == 4
    assert body[0] == {"name": "gz-server", "state": "RUNNING", "uptime_s": 120}


def test_reset_hits_gz(client: TestClient, fake_gz: FakeGz) -> None:
    assert client.post("/api/sim/reset").json()["ok"] is True
    assert fake_gz.resets == 1

#test API endpoint for vehicle pose modification
def test_set_vehicle_pose(client: TestClient, fake_gz: FakeGz) -> None:
    body = client.post("/api/sim/vehicle/pose", json={"x": 5, "y": 2}).json()
    assert body["ok"] is True
    assert fake_gz.poses == [(5.0, 2.0, 0.3, 0.0)]

#test API post rejection when vehicle is armed
def test_set_vehicle_pose_refused_while_armed(
    client: TestClient, fake_gz: FakeGz, fake_ros: FakeRos
) -> None:
    fake_ros.telemetry = {
        "t_us": 1,
        "armed": True,
        "mode": "offboard",
        "ned": {"x": 0.0, "y": 0.0, "z": -5.0},
        "battery_v": 15.8,
    }
    body = client.post("/api/sim/vehicle/pose", json={"x": 5, "y": 2}).json()
    assert body["ok"] is False
    assert "disarm" in body["detail"]
    assert fake_gz.poses == []

# test drone underground (invalid) pose rejection
def test_set_vehicle_pose_rejects_underground(client: TestClient) -> None:
    response = client.post("/api/sim/vehicle/pose", json={"x": 0, "y": 0, "z": -1})
    assert response.status_code == 422
