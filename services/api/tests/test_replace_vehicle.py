from pathlib import Path

from fastapi.testclient import TestClient

from tests.conftest import FakeGz, FakeSupervisor


def test_replace_writes_env_then_swaps_in_order(
    client: TestClient, call_trace: list[str], vehicle_env_path: Path, fake_gz: FakeGz
) -> None:
    response = client.post("/api/sim/vehicle", json={"model": "rc_cessna"})
    assert response.status_code == 202
    body = response.json()
    assert body["ok"] is True
    assert "x500" in body["detail"] and "rc_cessna" in body["detail"]
    # px4 boots the airframe from this file; gz_ prefix is px4's model naming
    assert vehicle_env_path.read_text() == "PX4_SYS_AUTOSTART=4003\nPX4_SIM_MODEL=gz_rc_cessna\n"
    # the old entity goes while px4 is down - restarting first would leave two
    assert call_trace == ["stop px4", "remove x500_0", "start px4"]
    assert fake_gz.removed == ["x500_0"]


def test_status_reports_the_selected_vehicle(client: TestClient) -> None:
    assert client.get("/api/sim/status").json()["vehicle"] == "x500"
    client.post("/api/sim/vehicle", json={"model": "omnicopter"})
    assert client.get("/api/sim/status").json()["vehicle"] == "omnicopter"


def test_second_replace_removes_the_model_now_flying(
    client: TestClient, call_trace: list[str]
) -> None:
    client.post("/api/sim/vehicle", json={"model": "r1_rover"})
    call_trace.clear()
    client.post("/api/sim/vehicle", json={"model": "x500_depth"})
    assert call_trace == ["stop px4", "remove r1_rover_0", "start px4"]


def test_unknown_model_refused_before_anything_moves(
    client: TestClient, call_trace: list[str], vehicle_env_path: Path
) -> None:
    response = client.post("/api/sim/vehicle", json={"model": "tiltrotor"})
    assert response.status_code == 422
    assert call_trace == []
    assert not vehicle_env_path.exists()


def test_gz_failure_names_the_step_and_leaves_px4_stopped(
    client: TestClient, call_trace: list[str], fake_gz: FakeGz
) -> None:
    fake_gz.remove_error = "gz found no entity named x500_0"
    body = client.post("/api/sim/vehicle", json={"model": "standard_vtol"}).json()
    assert body["ok"] is False
    assert "remove x500_0" in body["detail"]
    assert "px4 left stopped" in body["detail"]
    assert call_trace == ["stop px4", "remove x500_0"]


def test_supervisor_failure_names_the_step(
    client: TestClient, call_trace: list[str], fake_supervisor: FakeSupervisor
) -> None:
    fake_supervisor.stop_error = "px4: BAD_NAME"
    body = client.post("/api/sim/vehicle", json={"model": "px4vision"}).json()
    assert body["ok"] is False
    assert body["detail"].startswith("stop px4:")
    assert call_trace == ["stop px4"]
