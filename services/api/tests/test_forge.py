import json
from pathlib import Path

from fastapi.testclient import TestClient


def test_post_writes_the_spec_file_atomically(client: TestClient, forge_dir: Path) -> None:
    response = client.post(
        "/api/mission/forge",
        json={
            "name": "square1",
            "waypoints": [{"x": 10.0, "y": 0.0, "z": -5.0}, {"x": 10.0, "y": 10.0, "z": -5.0}],
            "rate_hz": 50,
        },
    )
    assert response.status_code == 202
    assert response.json()["ok"] is True

    spec_path = forge_dir / "square1.json"
    assert spec_path.exists()
    # no leftover tmp file from the atomic write
    assert list(forge_dir.glob("*.tmp")) == []
    spec = json.loads(spec_path.read_text())
    assert spec["name"] == "square1"
    assert len(spec["waypoints"]) == 2
    assert spec["rate_hz"] == 50
    # contract defaults ride along, same as /mission
    assert spec["return_to_origin"] is True


def test_post_rejects_bad_plans(client: TestClient, forge_dir: Path) -> None:
    assert client.post("/api/mission/forge", json={"waypoints": []}).status_code == 422
    assert not forge_dir.exists() or list(forge_dir.glob("*.json")) == []


def test_post_rejects_a_bad_name(client: TestClient, forge_dir: Path) -> None:
    response = client.post(
        "/api/mission/forge",
        json={"name": "Not Valid!", "waypoints": [{"x": 0, "y": 0, "z": -5}]},
    )
    assert response.status_code == 422
    assert not forge_dir.exists() or list(forge_dir.glob("*.json")) == []


def test_get_is_unknown_with_no_spec_and_no_result(client: TestClient) -> None:
    body = client.get("/api/mission/forge/square1").json()
    assert body == {"name": "square1", "state": "unknown", "detail": "no forge spec for that name"}


def test_get_is_queued_once_a_spec_exists(client: TestClient) -> None:
    client.post(
        "/api/mission/forge",
        json={"name": "square1", "waypoints": [{"x": 10.0, "y": 0.0, "z": -5.0}]},
    )
    body = client.get("/api/mission/forge/square1").json()
    assert body == {
        "name": "square1",
        "state": "queued",
        "detail": "waiting for the sim-side forge",
    }


def test_get_relays_the_watcher_result(client: TestClient, forge_dir: Path) -> None:
    forge_dir.mkdir(parents=True, exist_ok=True)
    (forge_dir / "square1.result.json").write_text(
        json.dumps({"name": "square1", "state": "building", "detail": "colcon building"})
    )
    body = client.get("/api/mission/forge/square1").json()
    assert body == {"name": "square1", "state": "building", "detail": "colcon building"}

    (forge_dir / "square1.result.json").write_text(
        json.dumps(
            {
                "name": "square1",
                "state": "done",
                "detail": "package square1 built; supervised program running",
            }
        )
    )
    body = client.get("/api/mission/forge/square1").json()
    assert body["state"] == "done"
    assert body["detail"] == "package square1 built; supervised program running"


def test_get_relays_a_failed_build(client: TestClient, forge_dir: Path) -> None:
    forge_dir.mkdir(parents=True, exist_ok=True)
    (forge_dir / "square1.result.json").write_text(
        json.dumps({"name": "square1", "state": "failed", "detail": "colcon build failed: exit 1"})
    )
    body = client.get("/api/mission/forge/square1").json()
    assert body == {
        "name": "square1",
        "state": "failed",
        "detail": "colcon build failed: exit 1",
    }


def test_get_degrades_to_unknown_on_invalid_result_json(
    client: TestClient, forge_dir: Path
) -> None:
    forge_dir.mkdir(parents=True, exist_ok=True)
    (forge_dir / "square1.result.json").write_text("not json")
    body = client.get("/api/mission/forge/square1").json()
    assert body["state"] == "unknown"
    assert "malformed" in body["detail"]
