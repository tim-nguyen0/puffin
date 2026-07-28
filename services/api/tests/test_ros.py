from fastapi.testclient import TestClient

from tests.conftest import FakeRos


def test_list_services(client: TestClient) -> None:
    body = client.get("/api/ros/services").json()
    assert body[0]["name"] == "/offboard_demo/change_state"
    assert body[0]["type"] == "lifecycle_msgs/srv/ChangeState"


def test_graph(client: TestClient) -> None:
    body = client.get("/api/ros/graph").json()
    assert "/offboard_demo" in body["nodes"]
    assert body["topics"][0]["name"] == "/fmu/out/vehicle_status_v1"


def test_lifecycle_state(client: TestClient) -> None:
    body = client.get("/api/ros/lifecycle/offboard_demo").json()
    assert body == {"node": "offboard_demo", "state": "inactive"}


def test_lifecycle_state_unknown_node(client: TestClient) -> None:
    body = client.get("/api/ros/lifecycle/nope").json()
    assert body["state"] == "unknown"


def test_activate_offboard_demo(client: TestClient, fake_ros: FakeRos) -> None:
    response = client.post(
        "/api/ros/lifecycle/offboard_demo/transition", json={"transition": "activate"}
    )
    assert response.json()["ok"] is True
    assert fake_ros.transitions == [("offboard_demo", "activate")]
    assert client.get("/api/ros/lifecycle/offboard_demo").json()["state"] == "active"


def test_invalid_transition_is_422(client: TestClient) -> None:
    response = client.post(
        "/api/ros/lifecycle/offboard_demo/transition", json={"transition": "explode"}
    )
    assert response.status_code == 422
