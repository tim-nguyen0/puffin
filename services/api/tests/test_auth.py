from fastapi.testclient import TestClient


def signup(client: TestClient, email: str = "student@example.com") -> dict:
    response = client.post(
        "/api/auth/signup",
        json={"email": email, "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()


def test_signup_login_me_and_logout(client: TestClient) -> None:
    created = signup(client)
    headers = {"Authorization": f"Bearer {created['token']}"}

    assert client.get("/api/auth/me", headers=headers).json()["email"] == "student@example.com"
    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/auth/me", headers=headers).status_code == 401

    logged_in = client.post(
        "/api/auth/login",
        json={"email": "student@example.com", "password": "password123"},
    )
    assert logged_in.status_code == 200


def test_duplicate_signup_is_rejected(client: TestClient) -> None:
    signup(client)
    response = client.post(
        "/api/auth/signup",
        json={"email": "student@example.com", "password": "password123"},
    )
    assert response.status_code == 409


def test_settings_require_login_and_persist(client: TestClient) -> None:
    assert client.get("/api/settings").status_code == 401

    created = signup(client)
    headers = {"Authorization": f"Bearer {created['token']}"}
    settings = {
        "units": "imperial",
        "telemetry_history_limit": 1200,
        "ws_url": "/ws/telemetry",
        "api_base_url": "/api",
        "terminal_x": 120.5,
        "terminal_y": -40.0,
        "terminal_minimized": True,
    }

    assert client.put("/api/settings", headers=headers, json=settings).status_code == 200
    assert client.get("/api/settings", headers=headers).json() == settings


def test_settings_are_separate_for_each_user(client: TestClient) -> None:
    first = signup(client, "first@example.com")
    second = signup(client, "second@example.com")
    first_headers = {"Authorization": f"Bearer {first['token']}"}
    second_headers = {"Authorization": f"Bearer {second['token']}"}

    changed = client.get("/api/settings", headers=first_headers).json()
    changed["units"] = "imperial"
    client.put("/api/settings", headers=first_headers, json=changed)

    assert client.get("/api/settings", headers=first_headers).json()["units"] == "imperial"
    assert client.get("/api/settings", headers=second_headers).json()["units"] == "metric"
