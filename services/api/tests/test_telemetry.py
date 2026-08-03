from fastapi.testclient import TestClient

from .conftest import FakeRos

SAMPLE = {
    "t_us": 1_234_567,
    "armed": True,
    "mode": "offboard",
    "ned": {"x": 1.0, "y": 2.0, "z": -5.0},
    "battery_v": 15.8,
    "attitude_q": [1.0, 0.0, 0.0, 0.0],
}


def test_stream_sends_latest_sample(client: TestClient, fake_ros: FakeRos) -> None:
    fake_ros.telemetry = SAMPLE
    with client.websocket_connect("/ws/telemetry") as ws:
        assert ws.receive_json() == SAMPLE


def test_stream_repeats_while_connected(client: TestClient, fake_ros: FakeRos) -> None:
    fake_ros.telemetry = SAMPLE
    with client.websocket_connect("/ws/telemetry") as ws:
        ws.receive_json()
        assert ws.receive_json() == SAMPLE


def test_stream_stays_quiet_until_data_arrives(
    client: TestClient, fake_ros: FakeRos
) -> None:
    # before px4 publishes anything the adapter returns not-ok; the stream
    # must skip those ticks instead of sending garbage or closing
    with client.websocket_connect("/ws/telemetry") as ws:
        fake_ros.telemetry = SAMPLE
        assert ws.receive_json() == SAMPLE


def test_stream_sample_matches_contract_shape(
    client: TestClient, fake_ros: FakeRos
) -> None:
    fake_ros.telemetry = SAMPLE
    with client.websocket_connect("/ws/telemetry") as ws:
        sample = ws.receive_json()
    assert set(sample) == {"t_us", "armed", "mode", "ned", "battery_v", "attitude_q"}
    assert set(sample["ned"]) == {"x", "y", "z"}
