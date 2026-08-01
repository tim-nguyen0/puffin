from fastapi.testclient import TestClient

from .conftest import FakeRos


def test_teleop_frames_reach_ros(client: TestClient, fake_ros: FakeRos) -> None:
    with client.websocket_connect("/ws/teleop") as ws:
        ws.send_json({"vx": 1.0, "vy": -0.5, "vz": 0.0, "yaw_rate": 0.2})
        ws.send_json({"vx": 0.0})
        ws.send_json({"vx": 0.0, "vy": 0.0, "vz": 0.0, "yaw_rate": 0.0})
    assert fake_ros.teleop_frames[0] == (1.0, -0.5, 0.0, 0.2)
    # missing fields default to zero - a release frame is just {}
    assert fake_ros.teleop_frames[1] == (0.0, 0.0, 0.0, 0.0)
