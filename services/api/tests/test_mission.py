import json

from fastapi.testclient import TestClient

from .conftest import FakeRos


def test_post_latches_the_mission_json(client: TestClient, fake_ros: FakeRos) -> None:
    response = client.post(
        "/api/mission",
        json={
            "waypoints": [
                {"x": 10.0, "y": 0.0, "z": -5.0},
                {"x": 10.0, "y": 10.0, "z": -5.0, "hold_s": 4.0},
            ],
            "rate_hz": 50,
            "takeoff_z": -3.0,
        },
    )
    assert response.status_code == 202
    assert response.json()["ok"] is True
    latched = json.loads(fake_ros.missions[0])
    assert len(latched["waypoints"]) == 2
    assert latched["waypoints"][1]["hold_s"] == 4.0
    # contract defaults ride along so the node needs no fallback logic
    assert latched["return_to_origin"] is True
    assert latched["name"] == "mission"


def test_post_rejects_bad_plans(client: TestClient, fake_ros: FakeRos) -> None:
    assert client.post("/api/mission", json={"waypoints": []}).status_code == 422
    assert (
        client.post(
            "/api/mission",
            json={"waypoints": [{"x": 0, "y": 0, "z": -5}], "rate_hz": 0.5},
        ).status_code
        == 422
    )
    assert fake_ros.missions == []


def test_post_rejects_a_bad_name(client: TestClient, fake_ros: FakeRos) -> None:
    response = client.post(
        "/api/mission",
        json={"name": "Not Valid!", "waypoints": [{"x": 0, "y": 0, "z": -5}]},
    )
    assert response.status_code == 422
    assert fake_ros.missions == []


def test_get_defaults_to_idle(client: TestClient) -> None:
    body = client.get("/api/mission").json()
    assert body["state"] == "idle"
    assert body["total"] == 0


def test_get_relays_the_executor_status(client: TestClient, fake_ros: FakeRos) -> None:
    fake_ros.mission_state = {
        "node": "mission",
        "state": "flying",
        "current_index": 1,
        "total": 4,
        "detail": "waypoint 2 of 4",
    }
    body = client.get("/api/mission").json()
    assert body == fake_ros.mission_state
