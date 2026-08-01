from fastapi.testclient import TestClient


def test_signup_creates_user_and_returns_token(client: TestClient) -> None:
    response = client.post(
        "/api/auth/signup", json={"email": "pilot@example.com", "password": "hunter22"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "pilot@example.com"
    assert body["user_id"]
    assert body["token"]


def test_signup_rejects_duplicate_email(client: TestClient) -> None:
    client.post("/api/auth/signup", json={"email": "pilot@example.com", "password": "hunter22"})
    response = client.post(
        "/api/auth/signup", json={"email": "pilot@example.com", "password": "different1"}
    )
    assert response.status_code == 409


def test_signup_rejects_short_password(client: TestClient) -> None:
    response = client.post(
        "/api/auth/signup", json={"email": "pilot@example.com", "password": "short"}
    )
    assert response.status_code == 422


def test_login_with_correct_credentials(client: TestClient) -> None:
    client.post("/api/auth/signup", json={"email": "pilot@example.com", "password": "hunter22"})
    response = client.post(
        "/api/auth/login", json={"email": "pilot@example.com", "password": "hunter22"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "pilot@example.com"


def test_login_with_wrong_password(client: TestClient) -> None:
    client.post("/api/auth/signup", json={"email": "pilot@example.com", "password": "hunter22"})
    response = client.post(
        "/api/auth/login", json={"email": "pilot@example.com", "password": "wrongpass"}
    )
    assert response.status_code == 401


def test_login_with_unknown_email(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "hunter22"}
    )
    assert response.status_code == 401


def test_me_without_token(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_with_valid_token(client: TestClient) -> None:
    signup = client.post(
        "/api/auth/signup", json={"email": "pilot@example.com", "password": "hunter22"}
    )
    token = signup.json()["token"]
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "pilot@example.com"
    assert body["id"] == signup.json()["user_id"]


def test_me_with_invalid_token(client: TestClient) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert response.status_code == 401
