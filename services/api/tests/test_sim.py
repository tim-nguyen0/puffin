from fastapi.testclient import TestClient

from tests.conftest import FakeSupervisor


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
