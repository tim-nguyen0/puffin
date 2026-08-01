"""SQLite storage for auth: schema, connection, and the crypto primitives it relies on."""

import hashlib
import hmac
import os
import sqlite3
import threading

_PBKDF2_ITERATIONS = 600_000
_SALT_BYTES = 16

# override in production; falls back to a dev-only default like PUFFIN_WORLD etc. do
_AUTH_SECRET = os.environ.get("PUFFIN_AUTH_SECRET", "dev-secret-change-me").encode()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    units TEXT NOT NULL DEFAULT 'metric',
    telemetry_history_limit INTEGER NOT NULL DEFAULT 500,
    ws_url TEXT NOT NULL DEFAULT '',
    api_base_url TEXT NOT NULL DEFAULT ''
);
"""


class Database:
    """Wraps the sqlite3 connection. One instance lives on app.state; requests share it."""

    def __init__(self, path: str = "puffin.db") -> None:
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    def create_user(self, email: str, password_hash: str) -> int:
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (email, password_hash),
            )
            self._conn.commit()
            return cur.lastrowid

    def get_user_by_email(self, email: str) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(
                "SELECT * FROM users WHERE email = ?", (email,)
            ).fetchone()

    def get_user_by_id(self, user_id: int) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()


def hash_password(password: str) -> str:
    salt = os.urandom(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"{_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    iterations, salt_hex, digest_hex = password_hash.split("$")
    salt = bytes.fromhex(salt_hex)
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
    return hmac.compare_digest(candidate.hex(), digest_hex)


def create_token(user_id: int) -> str:
    signature = hmac.new(_AUTH_SECRET, str(user_id).encode(), hashlib.sha256).hexdigest()
    return f"{user_id}.{signature}"


def verify_token(token: str) -> int | None:
    try:
        user_id_str, signature = token.split(".", 1)
    except ValueError:
        return None
    expected = hmac.new(_AUTH_SECRET, user_id_str.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    return int(user_id_str)
